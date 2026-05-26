import Link from "next/link";
import { AdminLogoutButton } from "./components/AdminLogoutButton";
import { authEnabled } from "../lib/auth/constants";
import { adminBackendFetch } from "../lib/admin/fetch";
import { requireAdminSession } from "../lib/auth/session";

export const dynamic = "force-dynamic";

async function getDashboard() {
  const response = await adminBackendFetch("/v1/tenants/ayvakit/dashboard");
  if (!response.ok) {
    throw new Error("Failed to load admin summary");
  }
  return response.json();
}

export default async function AdminPage() {
  const session = authEnabled() ? await requireAdminSession() : null;
  const dashboardData = await getDashboard();
  const { tenant, summary } = dashboardData;

  return (
    <main style={{ padding: 16 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
          <div style={{ color: "#f59e0b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em" }}>LandScrape Internal</div>
          <h1 style={{ margin: "6px 0 0" }}>Admin Console</h1>
          <div style={{ color: "#94a3b8", marginTop: 6, display: "flex", gap: 16, alignItems: "center" }}>
            <span>
              Tenant: {tenant.display_name}
              {session?.email ? ` · ${session.email}` : ""}
            </span>
            <Link href="/admin/activity" style={{ color: "#f59e0b" }}>
              Live Activity →
            </Link>
            <Link href="/admin/products" style={{ color: "#f59e0b" }}>
              Product roster →
            </Link>
          </div>
          {authEnabled() ? <AdminLogoutButton /> : null}
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            ["Open Signals", summary.openSignals],
            ["Priority Signals", summary.prioritySignals],
            ["Active Competitors", summary.activeCompetitors],
            ["Pending Approvals", summary.pendingApprovals]
          ].map(([label, value]) => (
            <div key={label} style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
              <div style={{ color: "#94a3b8" }}>{label}</div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>{String(value)}</div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>White-label Profile</h2>
            <p style={{ color: "#94a3b8" }}>Client-visible branding remains isolated from the hidden LandScrape core.</p>
          </div>

          <div style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Recommended Next Admin Tasks</h2>
            <ul style={{ color: "#94a3b8" }}>
              <li>Add users in Keycloak Admin Console and assign tenant groups</li>
              <li>Manage connector secrets via internal API key routes</li>
              <li>Replace synthetic adapters with live source adapters</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
