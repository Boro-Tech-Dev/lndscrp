import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enrichProduct,
  fetchClinicalTrialsSummary,
  fetchDailyMedLabels,
  fetchOpenFdaLabels,
} from "./enrich";
import { mergeLabelUpdates, parsePdufaFromText, pickBestTrial } from "./parsers";
import type { FetchFn, TrialSummary } from "./types";

describe("parsePdufaFromText", () => {
  it("extracts PDUFA date from narrative", () => {
    const d = parsePdufaFromText("Company expects PDUFA action date of June 15, 2026 for NDA filing.");
    assert.ok(d);
    assert.match(d!, /2026/);
  });
});

describe("mergeLabelUpdates", () => {
  it("dedupes and sorts by date desc", () => {
    const merged = mergeLabelUpdates([
      { date: "2024-01-01", title: "A", url: "u1", source: "DailyMed" },
      { date: "2025-06-01", title: "B", url: "u2", source: "openFDA" },
      { date: "2024-01-01", title: "A", url: "u1b", source: "DailyMed" },
    ]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.date, "2025-06-01");
  });
});

describe("pickBestTrial", () => {
  it("prefers phase 3", () => {
    const best = pickBestTrial([
      { nctId: "NCT1", phases: ["PHASE1"], overallStatus: "RECRUITING" },
      { nctId: "NCT2", phases: ["PHASE3"], overallStatus: "ACTIVE_NOT_RECRUITING" },
    ]);
    assert.equal(best?.nctId, "NCT2");
  });
});

describe("enrichProduct with mock fetch", () => {
  const mockFetch: FetchFn = async (url) => {
    if (url.includes("clinicaltrials.gov") || url.includes("clinicaltrials")) {
      return JSON.stringify({
        studies: [
          {
            protocolSection: {
              identificationModule: {
                nctId: "NCT00000001",
                officialTitle: "Phase 3 bezuclastinib PDUFA June 15, 2026",
              },
              statusModule: {
                overallStatus: "RECRUITING",
                primaryCompletionDateStruct: { date: "2025-12-01" },
              },
              designModule: { phases: ["PHASE3"] },
              descriptionModule: { briefSummary: "Study of bezuclastinib" },
            },
          },
        ],
      });
    }
    if (url.includes("drug/drugsfda")) {
      return JSON.stringify({
        results: [
          {
            application_number: "NDA123",
            submissions: [{ submission_status: "AP", submission_status_date: "20200115" }],
          },
        ],
      });
    }
    if (url.includes("drug/label.json")) {
      return JSON.stringify({
        results: [{ effective_time: "20240601", openfda: { brand_name: ["TEST"] }, set_id: "abc" }],
      });
    }
    if (url.includes("dailymed")) {
      return JSON.stringify({
        data: [{ setid: "def", title: "TEST SPL", published_date: "2024-03-15" }],
      });
    }
    throw new Error(`unexpected url ${url}`);
  };

  it("merges trial, fda, and dailymed for pipeline product", async () => {
    const result = await enrichProduct(
      {
        genericName: "bezuclastinib",
        brandName: "Bezuclastinib",
        lifecycleStage: "pipeline",
      },
      mockFetch
    );
    assert.equal(result.trialSummary.nctId, "NCT00000001");
    assert.ok(result.enrichedPdufaDate);
    assert.ok(result.labelUpdates.length >= 1);
  });

  it("clinical trials mock returns phase 3", async () => {
    const { summary } = await fetchClinicalTrialsSummary("bezuclastinib", mockFetch);
    assert.equal(summary.phases?.[0], "PHASE3");
  });
});
