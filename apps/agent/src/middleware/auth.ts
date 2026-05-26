import type { Request, Response, NextFunction } from "express";
import { getConfig } from "@landscrape/config";
import { canAccessTenant, parseLandscrapeClaims, verifyAccessToken } from "@landscrape/auth";
import type { LandscrapeAuthClaims } from "@landscrape/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: LandscrapeAuthClaims;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const config = getConfig();
  if (!config.authEnabled) {
    next();
    return;
  }
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token || !config.keycloakIssuer || !config.keycloakUrl || !config.keycloakRealm || !config.keycloakClientId || !config.keycloakClientSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = await verifyAccessToken(token, {
      keycloakUrl: config.keycloakUrl,
      realm: config.keycloakRealm,
      clientId: config.keycloakClientId,
      clientSecret: config.keycloakClientSecret,
      issuer: config.keycloakIssuer,
    });
    req.auth = parseLandscrapeClaims(payload as Record<string, unknown>);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
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

function pathParam(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}
