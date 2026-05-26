import { politeFetchText } from "../politeFetch";
import type { IngestedItem, SourceRow } from "../ingestTypes";
import { buildStableId, takeWords } from "../ingestUtils";

interface Study {
  protocolSection?: {
    identificationModule?: { officialTitle?: string; briefTitle?: string; nctId?: string };
    statusModule?: { lastUpdatePostDateStruct?: { date?: string }; startDateStruct?: { date?: string } };
    descriptionModule?: { briefSummary?: string };
    conditionsModule?: { conditions?: string[] };
  };
}

export function buildClinicalTrialsV2Url(source: SourceRow): string {
  const cfg = source.source_config ?? {};
  if (typeof cfg.trialsApiUrl === "string" && cfg.trialsApiUrl.trim()) {
    return cfg.trialsApiUrl.trim();
  }
  const params = new URLSearchParams();
  params.set("format", "json");
  const pageSize = Math.min(100, Math.max(1, Number(cfg.pageSize ?? cfg.maxItems ?? 20)));
  params.set("pageSize", String(pageSize));
  const q = (k: string) => (typeof cfg[k] === "string" ? (cfg[k] as string).trim() : "");
  const cond = q("query.cond") || q("condition");
  const intr = q("query.intr") || q("intervention");
  const titles = q("query.titles");
  const locn = q("query.locn");
  const term = q("query.term");
  if (cond) params.set("query.cond", cond);
  if (intr) params.set("query.intr", intr);
  if (titles) params.set("query.titles", titles);
  if (locn) params.set("query.locn", locn);
  if (term) params.set("query.term", term);
  if (![cond, intr, titles, locn, term].some(Boolean)) {
    throw new Error(
      `ClinicalTrials provider for '${source.source_name}': set source_config.query.cond, query.intr, query.term, or trialsApiUrl`
    );
  }
  return `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`;
}

export async function fetchClinicalTrialsGovItems(source: SourceRow): Promise<IngestedItem[]> {
  const url = source.base_url?.trim() ? source.base_url.trim() : buildClinicalTrialsV2Url(source);
  const raw = await politeFetchText(url);
  const json = JSON.parse(raw) as { studies?: Study[] };
  const studies: Study[] = Array.isArray(json?.studies) ? json.studies : [];
  const maxItems = Math.min(100, Math.max(1, Number(source.source_config?.maxItems ?? 20)));
  return studies.slice(0, maxItems).map((study, index) => {
    const id = study.protocolSection?.identificationModule?.nctId;
    if (!id) {
      throw new Error(`ClinicalTrials.gov study ${index + 1} for source '${source.source_name}' missing nctId`);
    }
    const officialTitle = study.protocolSection?.identificationModule?.officialTitle;
    const briefTitle = study.protocolSection?.identificationModule?.briefTitle;
    const title = (officialTitle ?? briefTitle ?? "").trim();
    if (!title) {
      throw new Error(`ClinicalTrials.gov study ${id} for source '${source.source_name}' has no officialTitle or briefTitle`);
    }
    const lastUpdate = study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date;
    const startDate = study.protocolSection?.statusModule?.startDateStruct?.date;
    const chosen = (lastUpdate ?? startDate ?? "").trim();
    if (!chosen) {
      throw new Error(`ClinicalTrials.gov study ${id} for source '${source.source_name}' has no lastUpdatePostDate or startDate`);
    }
    const summary = takeWords(study.protocolSection?.descriptionModule?.briefSummary ?? title, 60);
    const studyUrl = `https://clinicaltrials.gov/study/${id}`;
    return {
      externalItemId: id,
      title,
      summary,
      url: studyUrl,
      publishedAt: chosen,
      rawContent: JSON.stringify(study.protocolSection ?? {}),
      metadata: {
        format: "clinicaltrials_json",
        provider: "clinicaltrials_v2",
        nctId: id,
        conditions: study.protocolSection?.conditionsModule?.conditions ?? [],
      },
    } satisfies IngestedItem;
  });
}
