"use client";

import { useCallback, useEffect, useState } from "react";

type QueueCounts = { waiting: number; active: number; delayed: number };

type ActivityPayload = {
  generatedAt: string;
  queues: Record<string, QueueCounts>;
  events: Array<{
    id: string;
    ts: string;
    category: string;
    status: string;
    summary: string;
    tenantSlug?: string;
  }>;
  ollamaRollup: Array<{
    operation: string;
    model: string;
    call_count: string;
    avg_duration_sec: string | null;
  }>;
  toolAudit: Array<{
    audit_id: string;
    tool_id: string;
    status: string;
    duration_ms: number | null;
    created_at: string;
    tenant_slug: string | null;
  }>;
  infra: Array<{
    name: string;
    url: string;
    status: "ok" | "degraded" | "down";
    detail?: string;
  }>;
};

function statusColor(status: string): string {
  if (status === "completed" || status === "ok" || status === "created") return "#22c55e";
  if (status === "active" || status === "running" || status === "processing" || status === "queued") return "#f59e0b";
  if (status === "failed" || status === "down") return "#ef4444";
  return "#94a3b8";
}

export function ActivityDashboard() {
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) {
        setError(`Activity feed HTTP ${res.status}`);
        return;
      }
      setData((await res.json()) as ActivityPayload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load]);

  if (error) {
    return <p style={{ color: "#ef4444" }}>{error}</p>;
  }

  if (!data) {
    return <p style={{ color: "#94a3b8" }}>Loading activity…</p>;
  }

  const queueEntries = Object.entries(data.queues).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ color: "#94a3b8", fontSize: 12 }}>
        Last updated {new Date(data.generatedAt).toLocaleTimeString()} · polling every 3s
      </div>

      <section style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Infra health</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {data.infra.map((entry) => (
            <span
              key={entry.name}
              style={{
                border: "1px solid #334155",
                padding: "4px 10px",
                borderRadius: 4,
                color: statusColor(entry.status),
                fontSize: 13,
              }}
              title={entry.detail ?? entry.url}
            >
              {entry.name}: {entry.status}
            </span>
          ))}
        </div>
      </section>

      <section style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Queue backlog</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "#94a3b8", textAlign: "left" }}>
              <th style={{ padding: "4px 8px" }}>Queue</th>
              <th>Waiting</th>
              <th>Active</th>
              <th>Delayed</th>
            </tr>
          </thead>
          <tbody>
            {queueEntries.map(([name, counts]) => (
              <tr key={name}>
                <td style={{ padding: "4px 8px" }}>{name}</td>
                <td>{counts.waiting}</td>
                <td style={{ color: counts.active > 0 ? "#f59e0b" : undefined }}>{counts.active}</td>
                <td>{counts.delayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Ollama usage (15m)</h2>
        {data.ollamaRollup.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>No model calls in the last 15 minutes.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1" }}>
            {data.ollamaRollup.map((row) => (
              <li key={`${row.operation}-${row.model}`}>
                {row.operation} / {row.model}: {row.call_count} calls
                {row.avg_duration_sec ? ` · avg ${row.avg_duration_sec}s` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Recent events</h2>
        <div style={{ maxHeight: 420, overflow: "auto", fontSize: 13 }}>
          {data.events.length === 0 ? (
            <p style={{ color: "#94a3b8", margin: 0 }}>No events in the selected window.</p>
          ) : (
            data.events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 80px 1fr",
                  gap: 8,
                  padding: "6px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <span style={{ color: "#64748b" }}>{new Date(ev.ts).toLocaleTimeString()}</span>
                <span style={{ color: statusColor(ev.status) }}>{ev.status}</span>
                <span style={{ color: "#e2e8f0" }}>
                  [{ev.category}] {ev.summary}
                  {ev.tenantSlug ? ` · ${ev.tenantSlug}` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Agent tool audit</h2>
        {data.toolAudit.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>No tool invocations recently.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1", fontSize: 13 }}>
            {data.toolAudit.slice(0, 20).map((row) => (
              <li key={row.audit_id}>
                {row.tool_id} {row.status}
                {row.duration_ms != null ? ` (${row.duration_ms}ms)` : ""}
                {row.tenant_slug ? ` · ${row.tenant_slug}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
