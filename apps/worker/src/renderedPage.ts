import { getConfig } from "@landscrape/config";
import type { IngestedItem, PortalLoginConfig, SourceArtifactDraft, SourceRow } from "./ingestTypes";
import { asNumber, asString, buildStableId, normalizeHtmlContent, takeWords } from "./ingestUtils";

let playwrightModulePromise: Promise<typeof import("playwright")> | null = null;
let sharedBrowser: import("playwright").Browser | null = null;
let sharedBrowserLaunch: Promise<import("playwright").Browser> | null = null;

async function getPlaywright() {
  if (!playwrightModulePromise) playwrightModulePromise = import("playwright");
  return playwrightModulePromise;
}

async function getSharedBrowser(headless: boolean): Promise<import("playwright").Browser> {
  if (sharedBrowser?.isConnected()) return sharedBrowser;
  if (!sharedBrowserLaunch) {
    const playwright = await getPlaywright();
    sharedBrowserLaunch = playwright.chromium
      .launch({ headless, args: ["--disable-dev-shm-usage", "--no-sandbox"] })
      .then((browser) => {
        sharedBrowser = browser;
        browser.on("disconnected", () => {
          sharedBrowser = null;
          sharedBrowserLaunch = null;
        });
        return browser;
      })
      .catch((err) => {
        sharedBrowserLaunch = null;
        throw err;
      });
  }
  return sharedBrowserLaunch;
}

export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => undefined);
    sharedBrowser = null;
    sharedBrowserLaunch = null;
  }
}

function normalizeUrl(maybeUrl: string | null | undefined, baseUrl: string, context: string): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch (err) {
    throw new Error(`normalizeUrl: invalid URL '${maybeUrl}' with base '${baseUrl}' in ${context}: ${(err as Error).message}`);
  }
}

interface RenderedPageResult {
  html: string;
  title: string;
  url: string;
  screenshot: Buffer;
  items: Array<{
    title: string;
    summary: string;
    url: string | null;
    rawContent: string;
  }>;
}

export async function scrapeRenderedPage(
  page: import("playwright").Page,
  cfg: Record<string, unknown>,
  pageUrlForNorm: string
): Promise<RenderedPageResult> {
  const waitForSelector = asString(cfg.waitForSelector);
  if (waitForSelector) await page.waitForSelector(waitForSelector, { timeout: asNumber(cfg.timeoutMs, 45000) });
  const additionalWaitMs = asNumber(cfg.additionalWaitMs, 0);
  if (additionalWaitMs > 0) await page.waitForTimeout(additionalWaitMs);
  const itemSelector = asString(cfg.itemSelector);
  const titleSelector = asString(cfg.titleSelector);
  const summarySelector = asString(cfg.summarySelector);
  const linkSelector = asString(cfg.linkSelector, "a[href]");
  const maxItems = asNumber(cfg.maxItems, 12);
  const items = itemSelector
    ? await page.$$eval(
        itemSelector,
        (nodes, options) =>
          nodes
            .map((node) => {
              const root = node as HTMLElement;
              const titleNode = options.titleSelector
                ? root.querySelector(options.titleSelector)
                : root.querySelector("h1, h2, h3, a[href], strong, b");
              const summaryNode = options.summarySelector
                ? root.querySelector(options.summarySelector)
                : root.querySelector("p, div, span");
              const linkNode = options.linkSelector
                ? root.querySelector(options.linkSelector)
                : root.querySelector("a[href]");
              const title = titleNode?.textContent?.replace(/\s+/g, " ").trim() ?? "";
              const summary = summaryNode?.textContent?.replace(/\s+/g, " ").trim() ?? root.textContent?.replace(/\s+/g, " ").trim() ?? "";
              const rawContent = root.textContent?.replace(/\s+/g, " ").trim() ?? "";
              const url = linkNode?.getAttribute("href") ?? null;
              return { title, summary, rawContent, url };
            })
            .filter((item) => item.title || item.summary || item.rawContent)
            .slice(0, options.maxItems),
        { titleSelector, summarySelector, linkSelector, maxItems }
      )
    : [];
  const screenshot = await page.screenshot({ fullPage: true, type: "png" });
  const html = await page.content();
  const finalUrl = page.url();
  const title = await page.title();
  return {
    html,
    title,
    url: finalUrl,
    screenshot,
    items: items.map((item) => ({
      title: item.title || title,
      summary: item.summary || item.rawContent.slice(0, 800),
      rawContent: item.rawContent || item.summary || item.title,
      url: normalizeUrl(item.url, finalUrl, `scrapeRenderedPage(${pageUrlForNorm})`),
    })),
  };
}

function userAgentForRenderer(): string {
  const c = getConfig();
  return `LandScrapeBot/0.2 (+${c.contactUrl}; mailto:${c.contactEmail})`;
}

export async function renderPage(
  url: string,
  cfg: Record<string, unknown>,
  userAgentOverride: string
): Promise<RenderedPageResult> {
  const headless = cfg.headless !== false;
  const browser = await getSharedBrowser(headless);
  const context = await browser.newContext({
    userAgent: asString(cfg.userAgent, userAgentOverride),
    viewport: { width: asNumber(cfg.viewportWidth, 1440), height: asNumber(cfg.viewportHeight, 1600) },
    locale: asString(cfg.locale, "en-US"),
  });
  try {
    const page = await context.newPage();
    const timeout = asNumber(cfg.timeoutMs, 45000);
    const waitUntil = asString(cfg.waitUntil, "domcontentloaded") as "load" | "domcontentloaded" | "networkidle" | "commit";
    await page.goto(url, { waitUntil, timeout });
    return await scrapeRenderedPage(page, cfg, url);
  } finally {
    await context.close();
  }
}

function buildRenderedArtifacts(
  source: SourceRow,
  rendered: RenderedPageResult,
  mode: string,
  itemExternalId: string
): SourceArtifactDraft[] {
  return [
    {
      artifactType: "screenshot",
      storageKind: "s3",
      contentType: "image/png",
      body: rendered.screenshot,
      fileName: `${mode}-${itemExternalId}.png`,
      metadata: { pageUrl: rendered.url, pageTitle: rendered.title, sourceName: source.source_name },
    },
    {
      artifactType: "dom_snapshot",
      storageKind: "s3",
      contentType: "text/html; charset=utf-8",
      body: rendered.html,
      fileName: `${mode}-${itemExternalId}.html`,
      metadata: { pageUrl: rendered.url, pageTitle: rendered.title, sourceName: source.source_name },
    },
  ];
}

export function buildRenderedItems(source: SourceRow, rendered: RenderedPageResult, mode: string): IngestedItem[] {
  if (rendered.items.length > 0) {
    return rendered.items.map((item, index) => {
      const title = item.title?.trim();
      if (!title) {
        throw new Error(`Rendered item ${index + 1} from ${source.source_name} missing title (url=${rendered.url})`);
      }
      const externalItemId = buildStableId([mode, rendered.url, item.url, title, item.summary.slice(0, 400), `${index}`]);
      return {
        externalItemId,
        title,
        summary: takeWords(item.summary || item.rawContent, 70),
        url: item.url ?? rendered.url,
        publishedAt: null,
        rawContent: item.rawContent,
        metadata: { mode, rendered: true, pageTitle: rendered.title },
        artifacts: buildRenderedArtifacts(source, rendered, mode, externalItemId),
      };
    });
  }
  const normalized = normalizeHtmlContent(rendered.html);
  if (!normalized.title) {
    throw new Error(`Rendered page for ${source.source_name} (${rendered.url}) has no <title>`);
  }
  const externalItemId = buildStableId([mode, rendered.url, normalized.title, normalized.summary, normalized.content.slice(0, 4000)]);
  return [
    {
      externalItemId,
      title: normalized.title,
      summary: takeWords(normalized.summary, 70),
      url: rendered.url,
      publishedAt: null,
      rawContent: normalized.content,
      metadata: { mode, rendered: true, pageTitle: rendered.title },
      artifacts: buildRenderedArtifacts(source, rendered, mode, externalItemId),
    },
  ];
}

export { userAgentForRenderer };

export async function fetchPortalRenderedItems(
  source: SourceRow,
  userDataDir: string,
  login: PortalLoginConfig | null
): Promise<IngestedItem[]> {
  if (!source.base_url) throw new Error(`Portal source ${source.source_name} missing base_url`);
  const playwright = await getPlaywright();
  const cfg = source.source_config ?? {};
  const context = await playwright.chromium.launchPersistentContext(userDataDir, {
    headless: cfg.headless !== false,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
    userAgent: asString(cfg.userAgent, userAgentForRenderer()),
    viewport: { width: asNumber(cfg.viewportWidth, 1440), height: asNumber(cfg.viewportHeight, 1600) },
    locale: asString(cfg.locale, "en-US"),
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    if (login) {
      await page.goto(login.loginUrl, { waitUntil: "networkidle", timeout: asNumber(cfg.timeoutMs, 45000) });
      await page.fill(login.userSelector, login.username);
      await page.fill(login.passSelector, login.password);
      await page.click(login.submitSelector);
      await page.waitForTimeout(login.postLoginWaitMs ?? 4000);
    }
    const timeout = asNumber(cfg.timeoutMs, 45000);
    const waitUntil = asString(cfg.waitUntil, "domcontentloaded") as "load" | "domcontentloaded" | "networkidle" | "commit";
    await page.goto(source.base_url, { waitUntil, timeout });
    const rendered = await scrapeRenderedPage(page, cfg, source.base_url);
    return buildRenderedItems(source, rendered, "portal_rendered");
  } finally {
    await context.close();
  }
}
