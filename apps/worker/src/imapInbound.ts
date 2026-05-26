import { getConfig } from "@landscrape/config";
import { one, query } from "@landscrape/db";
import { createQueue, scheduledJobOptions } from "@landscrape/jobs";
import type { InboundNormalizePayload } from "@landscrape/jobs";
import { ImapFlow } from "imapflow";
import crypto from "crypto";

export function startImapInboundPoller(): void {
  const config = getConfig();
  if (!config.imapHost || !config.imapUser || !config.imapPassword) {
    console.log("[imap] disabled (set LANDSCRAPE_IMAP_HOST, USER, PASSWORD)");
    return;
  }

  const poll = async () => {
    const client = new ImapFlow({
      host: config.imapHost!,
      port: config.imapPort ?? 993,
      secure: config.imapTls !== false,
      auth: { user: config.imapUser!, pass: config.imapPassword! },
    });
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const tenant = await one<{ tenant_id: string }>(`SELECT tenant_id FROM tenants WHERE tenant_slug = $1`, [config.tenantSlug]);
        if (!tenant) return;

        const connector = await one<{ connector_id: string; connection_config: Record<string, unknown> }>(
          `SELECT connector_id, connection_config FROM connectors WHERE tenant_id = $1 AND connector_type = 'email' AND is_active = TRUE LIMIT 1`,
          [tenant.tenant_id]
        );
        if (!connector) {
          console.warn("[imap] no active email connector");
          return;
        }

        const defaultSourceId =
          typeof connector.connection_config.defaultInboundSourceId === "string"
            ? connector.connection_config.defaultInboundSourceId
            : "";
        if (!defaultSourceId) {
          console.warn("[imap] connection_config.defaultInboundSourceId required on email connector");
          return;
        }

        const st = await one<{ last_uid: number }>(`SELECT last_uid FROM email_mailbox_state WHERE connector_id = $1`, [connector.connector_id]);
        let lastUid = st?.last_uid ?? 0;

        const mb = client.mailbox;
        if (!mb || typeof mb === "boolean") return;
        const exists = mb.exists ?? 0;
        if (exists === 0 || lastUid >= exists) return;

        const range = `${lastUid + 1}:${exists}`;
        for await (const msg of client.fetch(range, { envelope: true, source: true, uid: true })) {
          if (!msg.uid) continue;
          const env = msg.envelope;
          const subject = String(env?.subject ?? "");
          const text = msg.source?.toString() ?? "";
          const dedupeKey = crypto.createHash("sha256").update(`${msg.uid}-${subject}-${text.slice(0, 200)}`).digest("hex");

          const ins = await one<{ inbound_event_id: string }>(
            `INSERT INTO inbound_events (tenant_id, channel, dedupe_key, processing_status, payload_summary)
             VALUES ($1, 'email', $2, 'pending', $3::jsonb)
             ON CONFLICT (tenant_id, dedupe_key) DO NOTHING
             RETURNING inbound_event_id`,
            [
              tenant.tenant_id,
              dedupeKey,
              JSON.stringify({
                title: subject || "Email",
                body: text.slice(0, 20_000),
                targetSourceId: defaultSourceId,
              }),
            ]
          );
          if (ins) {
            const q = createQueue("inbound:normalize");
            const payload: InboundNormalizePayload = {
              tenantId: tenant.tenant_id,
              inboundEventId: ins.inbound_event_id,
              channel: "email",
            };
            await q.add("inbound:normalize", payload, scheduledJobOptions());
          }
          lastUid = Math.max(lastUid, msg.uid);
        }

        await query(
          `INSERT INTO email_mailbox_state (tenant_id, connector_id, last_uid) VALUES ($1,$2,$3)
           ON CONFLICT (connector_id) DO UPDATE SET last_uid = EXCLUDED.last_uid, updated_at = NOW()`,
          [tenant.tenant_id, connector.connector_id, lastUid]
        );
      } finally {
        lock.release();
      }
    } catch (e) {
      console.error("[imap] poll error", e);
    } finally {
      await client.logout().catch(() => {});
    }
  };

  setInterval(() => {
    poll().catch((e) => console.error("[imap]", e));
  }, 120_000);
  poll().catch((e) => console.error("[imap]", e));
}
