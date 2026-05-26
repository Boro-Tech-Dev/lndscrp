"use client";

import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/";
  const error = searchParams.get("error");

  return (
    <form method="POST" action="/api/auth/login" style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="returnUrl" value={returnUrl} />
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          style={{ padding: 8, border: "1px solid #1e293b", background: "#000", color: "#fff" }}
          placeholder="admin@landscrape.local"
        />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          style={{ padding: 8, border: "1px solid #1e293b", background: "#000", color: "#fff" }}
        />
      </label>
      {error === "invalid" ? (
        <p style={{ color: "#f87171", fontSize: 12 }}>Invalid email or password.</p>
      ) : null}
      <button
        type="submit"
        style={{ padding: 8, border: "1px solid #f59e0b", background: "#000", color: "#f59e0b" }}
      >
        Sign in
      </button>
    </form>
  );
}
