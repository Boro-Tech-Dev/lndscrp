import { politeFetch } from "./politeFetch";

export interface ProbeResult {
  ok: boolean;
  status: number | null;
  statusText: string;
  contentType: string | null;
  durationMs: number;
  error: string | null;
}

export async function probeSource(url: string, timeoutMs = 10_000): Promise<ProbeResult> {
  const started = Date.now();
  try {
    // Some hosts reject HEAD (returning 405 or 403); use GET with a short timeout and don't read body fully.
    const response = await politeFetch(url, { method: "GET", timeoutMs });
    // Drain body to release connection.
    await response.text().catch(() => "");
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      durationMs: Date.now() - started,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      statusText: "",
      contentType: null,
      durationMs: Date.now() - started,
      error: (err as Error).message,
    };
  }
}
