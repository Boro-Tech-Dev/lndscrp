import fetch from "node-fetch";

interface TagResponse {
  models?: Array<{ name?: string }>;
}

function matchesModelName(available: string, required: string): boolean {
  if (available === required) return true;
  // Ollama tags list entries include implicit :latest sometimes; normalize.
  const [aName, aTag = "latest"] = available.split(":");
  const [rName, rTag = "latest"] = required.split(":");
  return aName === rName && aTag === rTag;
}

export async function assertOllamaModelReady(baseUrl: string, model: string): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable body>");
    throw new Error(
      `Ollama precondition failed: GET ${url} returned ${response.status} ${response.statusText}: ${body}`
    );
  }
  const data = (await response.json()) as TagResponse;
  const available = (data.models ?? []).map((m) => m.name ?? "").filter(Boolean);
  const found = available.some((name) => matchesModelName(name, model));
  if (!found) {
    throw new Error(
      `Ollama model '${model}' not available at ${baseUrl}. Tags returned: ${JSON.stringify(available)}`
    );
  }
  console.log(`[ollama] model '${model}' verified at ${baseUrl}`);
}
