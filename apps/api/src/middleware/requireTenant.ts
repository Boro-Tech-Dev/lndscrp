import type { Request, Response, NextFunction } from "express";
import { getConfig } from "@landscrape/config";
import { canAccessTenant } from "@landscrape/auth";

function pathParam(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  if (!config.authEnabled) {
    next();
    return;
  }

  const tenantSlug = pathParam(req, "tenantSlug");
  if (!tenantSlug) {
    res.status(400).json({ error: "Missing tenant slug" });
    return;
  }

  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!canAccessTenant(req.auth, tenantSlug)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

export function filterTenantsForAuth<T extends { tenant_slug: string }>(
  items: T[],
  auth: Request["auth"]
): T[] {
  if (!auth) return items;
  if (auth.roles.includes("admin") || auth.roles.includes("super_admin")) {
    return items;
  }
  const allowed = new Set(auth.tenants);
  return items.filter((item) => allowed.has(item.tenant_slug));
}
