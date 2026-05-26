"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-canvas text-stone-800">
      <div className="mx-auto flex min-h-screen max-w-lg items-center p-4">
        <div className="w-full rounded-soft border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-bold tracking-tight text-stone-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            {error.message || "An unexpected error occurred while loading this page."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-soft border border-border bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 shadow-sm transition hover:border-accent-green/40"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-soft border border-border bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800 shadow-sm transition hover:border-accent-green/40"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
