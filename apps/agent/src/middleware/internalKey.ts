import type { Request, Response, NextFunction } from "express";
import { getConfig } from "@landscrape/config";

const HEADER = "x-landscrape-internal-key";

export function requireInternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  const key = req.headers[HEADER];
  if (typeof key !== "string" || key !== config.internalApiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
