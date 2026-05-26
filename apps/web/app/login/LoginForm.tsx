"use client";

import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";
  const error = searchParams.get("error");

  return (
    <form method="POST" action="/api/auth/login" className="grid gap-3">
      <input type="hidden" name="returnUrl" value={returnUrl} />
      <label className="grid gap-1 text-xs">
        <span className="font-medium text-stone-700">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          className="rounded-soft border border-border bg-white px-3 py-2 text-sm text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          placeholder="demo@landscrape.local"
        />
      </label>
      <label className="grid gap-1 text-xs">
        <span className="font-medium text-stone-700">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="rounded-soft border border-border bg-white px-3 py-2 text-sm text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        />
      </label>
      {error === "invalid" ? (
        <p className="text-xs text-red-700">Invalid email or password.</p>
      ) : null}
      <button
        type="submit"
        className="rounded-soft border border-accent-green/45 bg-accent-green/10 px-3 py-2 text-sm font-medium text-accent-green transition hover:bg-accent-green/15"
      >
        Sign in
      </button>
    </form>
  );
}
