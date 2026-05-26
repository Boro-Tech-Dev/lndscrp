import type { Request, Response, NextFunction } from "express";
import { hasAdminRole } from "@landscrape/auth";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!hasAdminRole(req.auth)) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  next();
}
