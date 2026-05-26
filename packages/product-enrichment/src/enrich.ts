import { getConfig } from "@landscrape/config";
import fetch from "node-fetch";
import {
  buildTrialFromStudyJson,
  mergeLabelUpdates,
  normalizeDateString,
  pickBestTrial,
} from "./parsers";
import type {
  FetchFn,
  LabelUpdateEntry,
  ProductEnrichmentInput,
  ProductEnrichmentResult,
  RegulatorySummary,
  TrialSummary,
} from "./types";

function contactHeaders(): Record<string, string> {
  const config = getConfig();
  return {
    "User-Agent": `LandScrape-Intelligence/1.0 (+${config.contactUrl}; mailto:${config.contactEmail})`,
    From: config.contactEmail,
  };
}

export const defaultFetch: FetchFn = async (url, init) => {
  const res = await fetch(url, { headers: { ...contactHeaders(), ...init?.headers } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.text();
};

export async function fetchClinicalTrialsSummary(
  intervention: string,
  fetchFn: FetchFn = defaultFetch
): Promise<{ summary: TrialSummary; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.set("format", "json");
    params.set("pageSize", "5");
    params.set("query.intr", intervention.trim());
    const url = `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`;
    const raw = await fetchFn(url);
    const json = JSON.parse(raw) as { studies?: Record<string, unknown>[] };
    const studies = (json.studies ?? [])
      .map((s) => buildTrialFromStudyJson(s))
      .filter((s): s is TrialSummary => s !== null);
    const best = pickBestTrial(studies);
    return { summary: best ?? {} };
  } catch (e) {
    return { summary: {}, error: `ClinicalTrials.gov: ${String(e)}` };
  }
}

export async function fetchOpenFdaApproval(
  genericName: string,
  fetchFn: FetchFn = defaultFetch
): Promise<{ approvalDate?: string; applicationNumber?: string; error?: string }> {
  try {
    const config = getConfig();
    const params = new URLSearchParams();
    params.set("search", `openfda.substance_name:"${genericName.trim()}"`);
    params.set("limit", "3");
    const apiKey = config.openfdaApiKey?.trim();
    if (apiKey) params.set("api_key", apiKey);
    const url = `https://api.fda.gov/drug/drugsfda.json?${params.toString()}`;
    const raw = await fetchFn(url);
    const json = JSON.parse(raw) as {
      results?: Array<{
        application_number?: string;
        submissions?: Array<{ submission_status?: string; submission_status_date?: string }>;
      }>;
    };
    const results = json.results ?? [];
    let earliest: string | undefined;
    let appNum: string | undefined;
    for (const r of results) {
      appNum = appNum ?? r.application_number;
      const subs = r.submissions ?? [];
      for (const sub of subs) {
        const status = String(sub.submission_status ?? "").toUpperCase();
        if (status === "AP" || status.includes("APPROV")) {
          const d = sub.submission_status_date;
          if (d) {
            const norm = normalizeDateString(d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d);
            if (norm && (!earliest || norm < earliest)) earliest = norm;
          }
        }
      }
    }
    return { approvalDate: earliest, applicationNumber: appNum };
  } catch (e) {
    return { error: `openFDA drugsfda: ${String(e)}` };
  }
}

export async function fetchOpenFdaLabels(
  brandName: string,
  fetchFn: FetchFn = defaultFetch
): Promise<{ entries: LabelUpdateEntry[]; regulatory: Partial<RegulatorySummary>; error?: string }> {
  try {
    const config = getConfig();
    const params = new URLSearchParams();
    params.set("search", `openfda.brand_name:"${brandName.trim()}"`);
    params.set("sort", "effective_time:desc");
    params.set("limit", "3");
    const apiKey = config.openfdaApiKey?.trim();
    if (apiKey) params.set("api_key", apiKey);
    const url = `https://api.fda.gov/drug/label.json?${params.toString()}`;
    const raw = await fetchFn(url);
    const json = JSON.parse(raw) as {
      results?: Array<{
        effective_time?: string;
        openfda?: { brand_name?: string[] };
        set_id?: string;
        id?: string;
      }>;
    };
    const entries: LabelUpdateEntry[] = [];
    let latestLabelDate: string | undefined;
    let labelTitle: string | undefined;
    for (const r of json.results ?? []) {
      const et = r.effective_time;
      if (!et) continue;
      const norm =
        et.length === 8
          ? `${et.slice(0, 4)}-${et.slice(4, 6)}-${et.slice(6, 8)}`
          : normalizeDateString(et) ?? et;
      if (!latestLabelDate || norm > latestLabelDate) {
        latestLabelDate = norm;
        labelTitle = r.openfda?.brand_name?.[0] ?? brandName;
      }
      entries.push({
        date: norm,
        title: `${brandName} label update`,
        url: r.set_id
          ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${r.set_id}`
          : "https://open.fda.gov/",
        source: "openFDA",
      });
    }
    return {
      entries,
      regulatory: { latestLabelDate, labelTitle, splId: json.results?.[0]?.set_id },
    };
  } catch (e) {
    return { entries: [], regulatory: {}, error: `openFDA label: ${String(e)}` };
  }
}

export async function fetchDailyMedLabels(
  genericName: string,
  fetchFn: FetchFn = defaultFetch
): Promise<{ entries: LabelUpdateEntry[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.set("drug_name", genericName.trim());
    params.set("pagesize", "5");
    const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?${params.toString()}`;
    const raw = await fetchFn(url);
    const json = JSON.parse(raw) as {
      data?: Array<{
        setid?: string;
        title?: string;
        published_date?: string;
      }>;
    };
    const entries: LabelUpdateEntry[] = [];
    for (const row of json.data ?? []) {
      const setid = row.setid;
      const pub = row.published_date;
      if (!setid || !pub) continue;
      const norm = normalizeDateString(pub) ?? pub;
      entries.push({
        date: norm,
        title: row.title ?? `${genericName} SPL`,
        url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}`,
        source: "DailyMed",
      });
    }
    return { entries };
  } catch (e) {
    return { entries: [], error: `DailyMed: ${String(e)}` };
  }
}

export async function enrichProduct(
  input: ProductEnrichmentInput,
  fetchFn: FetchFn = defaultFetch
): Promise<ProductEnrichmentResult> {
  const intervention = (input.enrichIntervention ?? input.genericName).trim();
  const brand = (input.enrichBrandSearch ?? input.brandName).trim();
  const errors: string[] = [];

  const [trials, fdaApproval, fdaLabels, dailyMed] = await Promise.all([
    fetchClinicalTrialsSummary(intervention, fetchFn),
    fetchOpenFdaApproval(input.genericName, fetchFn),
    fetchOpenFdaLabels(brand, fetchFn),
    fetchDailyMedLabels(input.genericName, fetchFn),
  ]);

  if (trials.error) errors.push(trials.error);
  if (fdaApproval.error) errors.push(fdaApproval.error);
  if (fdaLabels.error) errors.push(fdaLabels.error);
  if (dailyMed.error) errors.push(dailyMed.error);

  const trialSummary = trials.summary;
  const regulatorySummary: RegulatorySummary = {
    approvalDate: fdaApproval.approvalDate,
    openfdaApplicationNumber: fdaApproval.applicationNumber,
    ...fdaLabels.regulatory,
  };

  const labelUpdates = mergeLabelUpdates([...fdaLabels.entries, ...dailyMed.entries]);

  let enrichedPdufaDate: string | null = null;
  if (input.lifecycleStage === "pipeline") {
    enrichedPdufaDate =
      trialSummary.pdufaDateFromText ??
      (trialSummary.timelineIsEstimated ? trialSummary.inferredTimelineDate ?? null : null);
  }

  const enrichedApprovalDate =
    regulatorySummary.approvalDate ??
    (input.lifecycleStage !== "pipeline" ? trialSummary.primaryCompletionDate ?? null : null);

  return {
    trialSummary,
    regulatorySummary,
    labelUpdates,
    enrichedPdufaDate,
    enrichedApprovalDate: enrichedApprovalDate ?? null,
    enrichmentErrors: errors,
  };
}
