import crypto from "crypto";

const PUBMED_MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function parsePubMedDate(raw: string): string {
  if (!raw || !raw.trim()) {
    throw new Error(`parsePubMedDate: empty input`);
  }
  const input = raw.trim();

  const slashMatch = input.match(/^(\d{4})(?:\/(\d{1,2}))?(?:\/(\d{1,2}))?(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (slashMatch) {
    const [, y, m = "1", d = "1", hh = "0", mm = "0"] = slashMatch;
    const iso = buildIso(Number(y), Number(m), Number(d), Number(hh), Number(mm));
    if (iso) return iso;
  }

  const wordMatch = input.match(/^(\d{4})(?:\s+([A-Za-z]+))?(?:\s+(\d{1,2}))?(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (wordMatch) {
    const [, y, monthWord, d = "1", hh = "0", mm = "0"] = wordMatch;
    const month = monthWord ? PUBMED_MONTHS[monthWord.toLowerCase()] : "01";
    if (!month) {
      throw new Error(`parsePubMedDate: unrecognized month word '${monthWord}' in '${raw}'`);
    }
    const iso = buildIso(Number(y), Number(month), Number(d), Number(hh), Number(mm));
    if (iso) return iso;
  }

  const parsed = Date.parse(input);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  throw new Error(`parsePubMedDate: unparseable pubdate '${raw}'`);
}

function buildIso(y: number, m: number, d: number, hh: number, mm: number): string | null {
  if (!Number.isInteger(y) || y < 1900 || y > 2100) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;
  if (!Number.isInteger(hh) || hh < 0 || hh > 23) return null;
  if (!Number.isInteger(mm) || mm < 0 || mm > 59) return null;
  const date = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizePublishedAt(raw: string | null | undefined, sourceName: string): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  const direct = Date.parse(trimmed);
  if (Number.isFinite(direct)) {
    return new Date(direct).toISOString();
  }

  try {
    return parsePubMedDate(trimmed);
  } catch (err) {
    throw new Error(
      `normalizePublishedAt: unparseable date '${raw}' for source '${sourceName}': ${(err as Error).message}`
    );
  }
}

export function buildStableId(parts: Array<string | null | undefined>): string {
  return crypto.createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex");
}

export function takeWords(input: string, maxWords = 60): string {
  return input.split(/\s+/).slice(0, maxWords).join(" ").trim();
}

/** Compact text for Ollama summary prompts (avoids dumping raw JSON/HTML). */
export function buildSummaryPromptBody(summary: string, fullText: string): string {
  const parts: string[] = [];
  const brief = takeWords(summary, 80);
  if (brief) parts.push(brief);
  const excerpt = takeWords(stripTags(fullText), 120);
  if (excerpt) parts.push(excerpt);
  return parts.join("\n\n");
}

export function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeXml(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function collectTagValues(xml: string, tagNames: string[]): string[] {
  const values: string[] = [];
  for (const tagName of tagNames) {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) values.push(decodeXml(match[1]));
  }
  return values.filter(Boolean);
}

export function getFirstTagValue(xml: string, tagNames: string[]): string | null {
  return collectTagValues(xml, tagNames)[0] ?? null;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeHtmlContent(html: string): { title: string | null; summary: string; content: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescriptionMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => stripTags(m[1]));
  const content = stripTags(html);
  const summary =
    [metaDescriptionMatch?.[1], ...headings].filter(Boolean).join(" | ").slice(0, 1200) || content.slice(0, 1200);
  return { title: titleMatch ? stripTags(titleMatch[1]) : null, summary, content };
}

export function requireString(value: unknown, field: string, sourceName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Missing required field '${field}' for source '${sourceName}' (got ${typeof value})`);
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`Empty required field '${field}' for source '${sourceName}'`);
  }
  return trimmed;
}
