import type { LandscrapeAuthClaims } from "@landscrape/auth";

export type SessionData = {
  accessToken: string;
  refreshToken: string;
  email: string;
  claims: LandscrapeAuthClaims;
  expiresAt: number;
};

export type StoredSession = SessionData;
