"use client";

import { useRouter } from "next/navigation";

type AuthUserMenuProps = {
  email: string;
};

export function AuthUserMenu({ email }: AuthUserMenuProps) {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="hidden truncate text-muted sm:inline" title={email}>
        {email}
      </span>
      <button
        type="button"
        onClick={onLogout}
        className="rounded-soft border border-border bg-stone-50/80 px-2 py-0.5 text-[11px] text-stone-600 hover:border-accent-brown/30"
      >
        Sign out
      </button>
    </div>
  );
}
