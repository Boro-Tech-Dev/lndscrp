import type { Request, Response, NextFunction } from "express";
import { getConfig } from "@landscrape/config";
import { parseLandscrapeClaims, verifyAccessToken, type LandscrapeAuthClaims } from "@landscrape/auth";

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
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!config.keycloakIssuer || !config.keycloakUrl || !config.keycloakRealm || !config.keycloakClientId || !config.keycloakClientSecret) {
    res.status(503).json({ error: "Auth is not configured" });
    return;
  }

  try {
    const payload = await verifyAccessToken(token, {
      keycloakUrl: config.keycloakUrl,
      realm: config.keycloakRealm,
      clientId: config.keycloakClientId,
      clientSecret: config.keycloakClientSecret,
      issuer: config.keycloakIssuer
    });
    req.auth = parseLandscrapeClaims(payload as Record<string, unknown>);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
