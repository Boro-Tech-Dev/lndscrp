#!/usr/bin/env node
/**
 * Patches xactions x402 middleware for self-hosted LandScrape (no micropayments).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "..", "node_modules", "xactions", "api", "middleware", "x402.js");

if (!fs.existsSync(target)) {
  console.error(`[patch-x402] not found: ${target}`);
  process.exit(1);
}

let src = fs.readFileSync(target, "utf8");
const marker = "export async function x402Middleware(req, res, next) {";
const patch = `export async function x402Middleware(req, res, next) {
  if (process.env.X402_DISABLED === 'true') {
    return next();
  }
  try {
    const { isX402Configured } = await import('../config/x402-config.js');
    if (!isX402Configured()) {
      return next();
    }
  } catch {
    return next();
  }`;

if (src.includes("X402_DISABLED === 'true'")) {
  console.log("[patch-x402] already patched");
  process.exit(0);
}

if (!src.includes(marker)) {
  console.error("[patch-x402] marker not found in x402.js");
  process.exit(1);
}

src = src.replace(marker, patch);
fs.writeFileSync(target, src);
console.log("[patch-x402] applied self-host bypass");
