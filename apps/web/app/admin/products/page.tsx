import Link from "next/link";
import { AdminLogoutButton } from "../components/AdminLogoutButton";
import { authEnabled } from "../../lib/auth/constants";
import { adminBackendFetch } from "../../lib/admin/fetch";
import { requireAdminSession } from "../../lib/auth/session";
import { ProductRosterEditor } from "./ProductRosterEditor";

export const dynamic = "force-dynamic";

const DEFAULT_TENANT = "ayvakit";

async function loadProducts(tenantSlug: string) {
  const response = await adminBackendFetch(`/v1/admin/tenants/${tenantSlug}/products`);
  if (!response.ok) {
    throw new Error("Failed to load product roster");
  }
  return response.json() as Promise<{ items: Parameters<typeof ProductRosterEditor>[0]["initialItems"] }>;
}

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const session = authEnabled() ? await requireAdminSession() : null;
  const sp = await searchParams;
  const tenantSlug = typeof sp.tenant === "string" && sp.tenant.length > 0 ? sp.tenant : DEFAULT_TENANT;
  const { items } = await loadProducts(tenantSlug);

  return (
    <main style={{ padding: 16 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ border: "1px solid #1e293b", background: "#000", padding: 16 }}>
          <div style={{ color: "#f59e0b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em" }}>
            LandScrape Internal
          </div>
          <h1 style={{ margin: "6px 0 0", color: "#f8fafc" }}>Product roster</h1>
          <div style={{ color: "#94a3b8", marginTop: 6, display: "flex", gap: 16, alignItems: "center" }}>
            <span>
              Tenant: {tenantSlug}
              {session?.email ? ` · ${session.email}` : ""}
            </span>
            <Link href="/admin" style={{ color: "#f59e0b" }}>
              Admin home →
            </Link>
            <Link href="/admin/activity" style={{ color: "#f59e0b" }}>
              Live Activity →
            </Link>
          </div>
          {authEnabled() ? <AdminLogoutButton /> : null}
        </header>

        <ProductRosterEditor tenantSlug={tenantSlug} initialItems={items} />
      </div>
    </main>
  );
}
