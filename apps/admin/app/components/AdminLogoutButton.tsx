"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      style={{
        marginTop: 8,
        padding: "4px 10px",
        border: "1px solid #334155",
        background: "#0f172a",
        color: "#94a3b8",
        fontSize: 12,
        cursor: "pointer"
      }}
    >
      Sign out
    </button>
  );
}
