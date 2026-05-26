"use client";

import { useCallback, useState, type CSSProperties } from "react";

type ProductTile = {
  productId: string;
  brandName: string;
  genericName: string;
  company: string | null;
  role: "owned" | "competitor";
  therapeuticClass: string | null;
  indications: string[];
  lifecycleStage: "pipeline" | "approved" | "generic";
  sortOrder: number;
  hcpUrl: string | null;
  dtcUrl: string | null;
  labelUrl: string | null;
  pdufaDate: string | null;
  approvalDate: string | null;
  loeDate: string | null;
  lastEnrichedAt: string | null;
  enrichmentErrors: string[];
};

type FormState = {
  brand_name: string;
  generic_name: string;
  company: string;
  role: "owned" | "competitor";
  therapeutic_class: string;
  indications: string;
  lifecycle_stage: "pipeline" | "approved" | "generic";
  sort_order: number;
  hcp_url: string;
  dtc_url: string;
  label_url: string;
  curated_pdufa_date: string;
  curated_approval_date: string;
  curated_loe_date: string;
};

const emptyForm: FormState = {
  brand_name: "",
  generic_name: "",
  company: "",
  role: "competitor",
  therapeutic_class: "",
  indications: "",
  lifecycle_stage: "approved",
  sort_order: 99,
  hcp_url: "",
  dtc_url: "",
  label_url: "",
  curated_pdufa_date: "",
  curated_approval_date: "",
  curated_loe_date: "",
};

function tileToForm(p: ProductTile): FormState {
  return {
    brand_name: p.brandName,
    generic_name: p.genericName,
    company: p.company ?? "",
    role: p.role,
    therapeutic_class: p.therapeuticClass ?? "",
    indications: p.indications.join(", "),
    lifecycle_stage: p.lifecycleStage,
    sort_order: p.sortOrder,
    hcp_url: p.hcpUrl ?? "",
    dtc_url: p.dtcUrl ?? "",
    label_url: p.labelUrl ?? "",
    curated_pdufa_date: p.pdufaDate ?? "",
    curated_approval_date: p.approvalDate ?? "",
    curated_loe_date: p.loeDate ?? "",
  };
}

function formToBody(form: FormState): Record<string, unknown> {
  const indications = form.indications
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    brand_name: form.brand_name,
    generic_name: form.generic_name,
    company: form.company || null,
    role: form.role,
    therapeutic_class: form.therapeutic_class || null,
    indications,
    lifecycle_stage: form.lifecycle_stage,
    sort_order: form.sort_order,
    hcp_url: form.hcp_url || null,
    dtc_url: form.dtc_url || null,
    label_url: form.label_url || null,
    curated_pdufa_date: form.curated_pdufa_date || null,
    curated_approval_date: form.curated_approval_date || null,
    curated_loe_date: form.curated_loe_date || null,
  };
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#f8fafc",
  fontSize: 13,
};

const labelStyle: CSSProperties = { color: "#94a3b8", fontSize: 11, marginBottom: 4 };

type Props = {
  tenantSlug: string;
  initialItems: ProductTile[];
};

export function ProductRosterEditor({ tenantSlug, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.productId ?? null);
  const [form, setForm] = useState<FormState>(
    initialItems[0] ? tileToForm(initialItems[0]) : emptyForm
  );
  const [isNew, setIsNew] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/api/tenants/${tenantSlug}/products`;

  const reload = useCallback(async () => {
    const res = await fetch(base, { cache: "no-store" });
    if (!res.ok) throw new Error(`Load failed ${res.status}`);
    const json = (await res.json()) as { items: ProductTile[] };
    setItems(json.items);
    return json.items;
  }, [base]);

  const select = (p: ProductTile) => {
    setSelectedId(p.productId);
    setForm(tileToForm(p));
    setIsNew(false);
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const body = formToBody(form);
      if (isNew) {
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const created = (await res.json()) as ProductTile;
        const list = await reload();
        const found = list.find((i) => i.productId === created.productId) ?? created;
        select(found);
        setIsNew(false);
        setStatus("Created and enrichment queued.");
      } else if (selectedId) {
        const res = await fetch(`${base}/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        await reload();
        setStatus("Saved and enrichment queued.");
      }
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId || isNew) return;
    if (!confirm(`Delete ${form.brand_name}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/${selectedId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`Delete ${res.status}`);
      const list = await reload();
      if (list[0]) {
        select(list[0]);
      } else {
        setSelectedId(null);
        setForm(emptyForm);
        setIsNew(true);
      }
      setStatus("Deleted.");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshEnrichment = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/${selectedId}/refresh`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setStatus("Enrichment refresh queued.");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  const bootstrapAll = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${base}/bootstrap-enrich`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { productsEnqueued: number };
      setStatus(`Queued enrichment for ${json.productsEnqueued} products.`);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  const selected = items.find((i) => i.productId === selectedId);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
      <div style={{ border: "1px solid #1e293b", background: "#000", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#f59e0b", fontSize: 12, textTransform: "uppercase" }}>Roster</span>
          <button
            type="button"
            onClick={() => {
              setIsNew(true);
              setSelectedId(null);
              setForm(emptyForm);
            }}
            style={{ fontSize: 11, color: "#f59e0b", background: "none", border: "none", cursor: "pointer" }}
          >
            + Add
          </button>
        </div>
        {items.map((p) => (
          <button
            key={p.productId}
            type="button"
            onClick={() => select(p)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px",
              marginBottom: 4,
              border: selectedId === p.productId ? "1px solid #f59e0b" : "1px solid #1e293b",
              background: selectedId === p.productId ? "#1e293b" : "#0f172a",
              color: "#e2e8f0",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {p.brandName}
            <span style={{ color: "#64748b", marginLeft: 6, fontSize: 11 }}>{p.role}</span>
            {p.enrichmentErrors.length > 0 ? (
              <span style={{ color: "#f59e0b", marginLeft: 4 }}>!</span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void bootstrapAll()}
          disabled={busy}
          style={{ marginTop: 12, fontSize: 11, color: "#94a3b8", background: "none", border: "1px solid #334155", padding: "6px 8px", cursor: "pointer", width: "100%" }}
        >
          Enrich all products
        </button>
      </div>

      <div style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
        <h2 style={{ marginTop: 0, color: "#f8fafc" }}>{isNew ? "New product" : form.brand_name}</h2>
        {selected?.lastEnrichedAt ? (
          <p style={{ color: "#64748b", fontSize: 12 }}>
            Last enriched: {new Date(selected.lastEnrichedAt).toLocaleString()}
          </p>
        ) : (
          <p style={{ color: "#64748b", fontSize: 12 }}>Not enriched yet</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          {(
            [
              ["brand_name", "Brand name"],
              ["generic_name", "Generic name"],
              ["company", "Company"],
              ["therapeutic_class", "Class"],
              ["indications", "Indications (comma-separated)"],
              ["hcp_url", "HCP URL"],
              ["dtc_url", "DTC URL"],
              ["label_url", "Label URL"],
              ["curated_pdufa_date", "PDUFA (YYYY-MM-DD)"],
              ["curated_approval_date", "Approval date"],
              ["curated_loe_date", "LOE date"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{ gridColumn: key.includes("url") || key === "indications" ? "1 / -1" : undefined }}>
              <div style={labelStyle}>{label}</div>
              <input
                style={inputStyle}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label>
            <div style={labelStyle}>Role</div>
            <select
              style={inputStyle}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FormState["role"] }))}
            >
              <option value="owned">owned</option>
              <option value="competitor">competitor</option>
            </select>
          </label>
          <label>
            <div style={labelStyle}>Lifecycle</div>
            <select
              style={inputStyle}
              value={form.lifecycle_stage}
              onChange={(e) =>
                setForm((f) => ({ ...f, lifecycle_stage: e.target.value as FormState["lifecycle_stage"] }))
              }
            >
              <option value="pipeline">pipeline</option>
              <option value="approved">approved</option>
              <option value="generic">generic</option>
            </select>
          </label>
          <label>
            <div style={labelStyle}>Sort order</div>
            <input
              type="number"
              style={inputStyle}
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            style={{ padding: "8px 14px", background: "#f59e0b", color: "#000", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            Save
          </button>
          {!isNew && selectedId ? (
            <>
              <button
                type="button"
                onClick={() => void refreshEnrichment()}
                disabled={busy}
                style={{ padding: "8px 14px", background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", cursor: "pointer" }}
              >
                Refresh enrichment
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                style={{ padding: "8px 14px", background: "#450a0a", color: "#fecaca", border: "1px solid #7f1d1d", cursor: "pointer" }}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
        {status ? <p style={{ marginTop: 12, color: "#94a3b8", fontSize: 12 }}>{status}</p> : null}
      </div>
    </div>
  );
}
