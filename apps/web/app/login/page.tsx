import { Suspense } from "react";
import { cookies } from "next/headers";
import { clearOrphanSessionCookie } from "@landscrape/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await clearOrphanSessionCookie(await cookies());

  return (
    <main className="min-h-screen bg-canvas text-stone-800">
      <div className="mx-auto flex min-h-screen max-w-md items-center p-4">
        <div className="w-full rounded-soft border border-border bg-surface p-6 shadow-sm">
          <div className="mb-5 border-b border-border pb-4">
            <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-accent-green">LS</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-stone-900">Sign in to LandScrape</h1>
            <p className="mt-1 text-xs text-muted">Use your workspace credentials to continue.</p>
          </div>
          <Suspense fallback={<p className="text-xs text-muted">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
