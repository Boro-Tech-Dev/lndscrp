import { createRemoteJWKSet, jwtVerify, errors as joseErrors, type JWTPayload } from "jose";
import type { KeycloakAuthConfig, KeycloakTokenResponse } from "./types";

const {
  JOSEError,
  JWKSNoMatchingKey,
  JWSSignatureVerificationFailed,
  JWTClaimValidationFailed,
  JWTExpired,
  JWTInvalid,
  JWSInvalid
} = joseErrors;

const DEFINITIVE_TOKEN_FAILURE_CODES = new Set([
  JWKSNoMatchingKey.code,
  JWSSignatureVerificationFailed.code,
  JWTClaimValidationFailed.code,
  JWTExpired.code,
  JWTInvalid.code,
  JWSInvalid.code
]);

/** True when JWT verification failed due to an invalid/revoked token, not infra blips. */
export function isDefinitiveTokenFailure(err: unknown): boolean {
  return err instanceof JOSEError && DEFINITIVE_TOKEN_FAILURE_CODES.has(err.code);
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksIssuer: string | null = null;

function tokenEndpoint(config: KeycloakAuthConfig): string {
  const base = config.keycloakUrl.replace(/\/$/, "");
  return `${base}/realms/${config.realm}/protocol/openid-connect/token`;
}

function logoutEndpoint(config: KeycloakAuthConfig): string {
  const base = config.keycloakUrl.replace(/\/$/, "");
  return `${base}/realms/${config.realm}/protocol/openid-connect/logout`;
}

function getJwks(config: KeycloakAuthConfig) {
  if (!jwksCache || jwksIssuer !== config.issuer) {
    jwksIssuer = config.issuer;
    jwksCache = createRemoteJWKSet(new URL(`${config.issuer}/protocol/openid-connect/certs`));
  }
  return jwksCache;
}

async function postToken(config: KeycloakAuthConfig, body: URLSearchParams): Promise<KeycloakTokenResponse> {
  const response = await fetch(tokenEndpoint(config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keycloak token request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<KeycloakTokenResponse>;
}

export async function fetchKeycloakTokenPassword(
  config: KeycloakAuthConfig,
  username: string,
  password: string
): Promise<KeycloakTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    username,
    password
  });
  return postToken(config, body);
}

export async function fetchKeycloakTokenRefresh(
  config: KeycloakAuthConfig,
  refreshToken: string
): Promise<KeycloakTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken
  });
  return postToken(config, body);
}

export async function revokeKeycloakRefreshToken(
  config: KeycloakAuthConfig,
  refreshToken: string
): Promise<void> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken
  });
  const response = await fetch(logoutEndpoint(config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keycloak logout failed (${response.status}): ${text}`);
  }
}

export async function verifyAccessToken(
  token: string,
  config: KeycloakAuthConfig
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwks(config), {
    issuer: config.issuer
  });
  return payload;
}

export function keycloakConfigFromEnv(env: NodeJS.ProcessEnv = process.env): KeycloakAuthConfig | null {
  const keycloakUrl = env.KEYCLOAK_URL?.trim();
  const realm = env.KEYCLOAK_REALM?.trim();
  const clientId = env.KEYCLOAK_CLIENT_ID?.trim();
  const clientSecret = env.KEYCLOAK_CLIENT_SECRET?.trim();
  const issuer =
    env.KEYCLOAK_ISSUER?.trim() ||
    (keycloakUrl && realm ? `${keycloakUrl.replace(/\/$/, "")}/realms/${realm}` : undefined);

  if (!keycloakUrl || !realm || !clientId || !clientSecret || !issuer) {
    return null;
  }

  return { keycloakUrl, realm, clientId, clientSecret, issuer };
}
