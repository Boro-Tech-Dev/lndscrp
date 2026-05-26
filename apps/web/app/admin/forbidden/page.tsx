import Link from "next/link";
import { requireSession } from "../../lib/auth/session";
import { authEnabled } from "../../lib/auth/constants";

export const dynamic = "force-dynamic";

export default async function AdminForbiddenPage() {
  const session = authEnabled() ? await requireSession() : null;

  return (
    <main style={{ padding: 16 }}>
      <div style={{ maxWidth: 560, margin: "10vh auto", border: "1px solid #1e293b", padding: 24 }}>
        <div style={{ color: "#f59e0b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em" }}>
          LandScrape Admin
        </div>
        <h1 style={{ marginTop: 8 }}>Admin access required</h1>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          Your account{session?.email ? ` (${session.email})` : ""} is signed in but does not have the admin role.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/" style={{ color: "#f59e0b" }}>
            ← Back to workspace
          </Link>
        </p>
      </div>
    </main>
  );
}
