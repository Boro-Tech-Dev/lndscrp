export function authEnabled(): boolean {
  return (process.env.AUTH_ENABLED ?? "true") === "true";
}
