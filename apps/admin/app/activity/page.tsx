import Link from "next/link";
import { hasAdminRole } from "@landscrape/auth";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "../components/AdminLogoutButton";
import { ActivityDashboard } from "./ActivityDashboard";
import { authEnabled } from "../lib/auth/constants";
import { requireSession } from "../lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = authEnabled() ? await requireSession() : null;
  if (authEnabled() && session && !hasAdminRole(session.claims)) {
    redirect("/login?error=admin_required");
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
          <div style={{ color: "#f59e0b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em" }}>
            LandScrape Internal
          </div>
          <h1 style={{ margin: "6px 0 0" }}>Live Activity</h1>
          <div style={{ color: "#94a3b8", marginTop: 6, display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/" style={{ color: "#f59e0b" }}>
              ← Admin console
            </Link>
            {session?.email ? <span>{session.email}</span> : null}
            {authEnabled() ? <AdminLogoutButton /> : null}
          </div>
        </header>
        <ActivityDashboard />
      </div>
    </main>
  );
}
