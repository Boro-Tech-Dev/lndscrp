export type LandscrapeAuthClaims = {
  sub: string;
  email: string;
  roles: string[];
  tenants: string[];
};

export type KeycloakTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type: string;
};

export type KeycloakAuthConfig = {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
};
