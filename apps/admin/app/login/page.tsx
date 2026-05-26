import { Suspense } from "react";
import { cookies } from "next/headers";
import { clearOrphanSessionCookie } from "@landscrape/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  await clearOrphanSessionCookie(await cookies());

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 24 }}>
      <div style={{ maxWidth: 420, margin: "10vh auto", border: "1px solid #1e293b", padding: 24 }}>
        <div style={{ color: "#f59e0b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em" }}>
          LandScrape Internal
        </div>
        <h1 style={{ marginTop: 8 }}>Admin sign in</h1>
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Requires Keycloak admin role.</p>
        <Suspense fallback={<p style={{ color: "#94a3b8" }}>Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
