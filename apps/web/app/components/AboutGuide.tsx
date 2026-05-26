import Link from "next/link";
import type { ReactNode } from "react";
import { withTenant } from "../lib/navigation";

type AboutGuideProps = {
  tenantSlug: string;
};

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-soft border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
      </div>
      <div className="space-y-3 px-4 py-3 text-xs leading-relaxed text-stone-800">{children}</div>
    </section>
  );
}

function ToolCard({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-soft border border-border bg-stone-50/60 px-3 py-3">
      <h3 className="text-xs font-semibold text-stone-900">{title}</h3>
      <p className="mt-0.5 text-2xs text-muted">{source}</p>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-stone-800">{children}</div>
    </div>
  );
}

function GlossaryEntry({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="border-b border-border py-2 last:border-b-0">
      <dt className="text-xs font-semibold text-stone-900">{term}</dt>
      <dd className="mt-0.5 text-xs leading-relaxed text-stone-700">{definition}</dd>
    </div>
  );
}

export function AboutGuide({ tenantSlug }: AboutGuideProps) {
  const researchHref = withTenant("/research", tenantSlug);

  return (
    <div className="grid gap-2 pb-4">
      <div
        className="rounded-soft border border-border px-4 py-3 shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent, #5a8a6e) 8%, transparent), transparent)",
        }}
      >
        <p className="text-xs leading-relaxed text-stone-800">
          Learn how LandScrape turns public clinical data and your workspace signals into market
          intelligence — what runs behind the scenes, which tools the research assistant can use, and
          how to work with it safely.
        </p>
      </div>

      <GuideSection title="What LandScrape does">
        <p>
          LandScrape is a <strong>pharmaceutical market intelligence</strong> platform. It helps teams
          track competitive landscape, regulatory updates, clinical trials, congress activity, and
          published literature — aggregated into signals you can search, alert on, and brief from.
        </p>
        <p>
          It is <strong>not</strong> clinical decision support and must not be used to care for
          individual patients. It does not replace medical judgment, prescribing decisions, or
          regulatory submissions.
        </p>
        <p className="font-medium text-stone-900">Two automated capabilities power the product:</p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong>Ingest summaries</strong> — When new content arrives (feeds, connectors, email),
            a language model condenses each item into a short, executive-readable summary attached to
            the signal.
          </li>
          <li>
            <strong>Research agent</strong> — On the Research page, you ask questions in natural
            language. The agent can call public reference tools and search your workspace, then
            synthesize a cited answer.
          </li>
        </ul>
        <p>
          Reasoning runs <strong>locally</strong> on your deployment&apos;s infrastructure (a local
          language model runtime). Your research questions and workspace context are not sent to a
          public chatbot service by default.
        </p>
      </GuideSection>

      <GuideSection title="Models explained">
        <p>
          LandScrape uses small, specialized models tuned for structured market intelligence — not
          general creative writing.
        </p>

        <div className="space-y-3 rounded-soft border border-border bg-stone-50/60 px-3 py-3">
          <h3 className="text-xs font-semibold text-stone-900">Language model (llama3.2:3b)</h3>
          <p>
            A <strong>3-billion-parameter</strong> model is compact enough to run on modest hardware
            while still following instructions reliably. &quot;3B&quot; refers to the number of
            learned weights — larger models can be more fluent but need more memory and time.
          </p>
          <p>It powers:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Automatic summaries when signals are ingested</li>
            <li>Interactive Research chat</li>
            <li>Executive briefing documents (including agent-backed deep briefs)</li>
            <li>Enrichment of high-importance signals with extra public context</li>
          </ul>
          <p className="text-2xs text-muted">
            Best for: competitive themes, regulatory framing, trial landscape questions. Less ideal
            for: long-form creative prose or open-ended brainstorming unrelated to your data.
          </p>
        </div>

        <div className="space-y-3 rounded-soft border border-border bg-stone-50/60 px-3 py-3">
          <h3 className="text-xs font-semibold text-stone-900">Embedding model (nomic-embed-text)</h3>
          <p>
            An <strong>embedding model</strong> converts text into a list of numbers (a vector) that
            captures meaning. Similar ideas end up close together in that space even when they use
            different words.
          </p>
          <p>
            <strong>Keyword search</strong> looks for exact words — if a signal says &quot;KIT
            inhibitor&quot; but you search &quot;avapritinib,&quot; you may miss it.
          </p>
          <p>
            <strong>Semantic search</strong> uses embeddings — the same search can surface signals
            about related mechanisms or drug classes even when the exact phrase never appears.
          </p>
          <p className="text-2xs text-muted">
            Every ingested signal is summarized and embedded so the workspace search bar can offer
            keyword, semantic, and hybrid modes.
          </p>
        </div>

        <p className="text-2xs text-muted">
          Some deployments may route the research agent to a hosted language model instead of the
          local one. The same tools, allowlist, and safety rules apply either way.
        </p>
      </GuideSection>

      <GuideSection title="What is MCP?">
        <p>
          <strong>MCP (Model Context Protocol)</strong> is an open standard for how an assistant
          discovers and calls external tools — search APIs, databases, calculators — in a consistent
          way.
        </p>
        <p>
          Think of the language model as the analyst and MCP tools as dedicated phone lines: one to
          PubMed, one to ClinicalTrials.gov, one to openFDA. The model decides when to dial; the tool
          returns structured results; the model weaves those into your answer.
        </p>
        <p>
          LandScrape runs its own MCP <strong>sidecars</strong> — small services inside the platform
          that wrap public healthcare APIs behind a standard tool interface. You do not install or
          configure MCP in Cursor, VS Code, or other IDEs; it is built into LandScrape for the
          research agent.
        </p>
        <p>
          The same public sources can also be reached through a direct API path when sidecars are
          unavailable. From your perspective, the capabilities are the same; only the plumbing
          differs.
        </p>
      </GuideSection>

      <GuideSection title="Clinical Reference Kit">
        <p className="text-2xs text-muted">
          The research agent can call only these public reference tools plus your workspace signals.
          Each card below explains what it is, what you can learn, and how to ask good questions.
        </p>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <ToolCard title="PubMed search" source="NIH — NCBI E-utilities">
            <p>
              PubMed indexes biomedical literature — journal articles, reviews, and citations from
              MEDLINE and related sources (tens of millions of records).
            </p>
            <p>
              <strong>The agent can learn:</strong> recent publications on a drug, indication, or
              mechanism; titles and PMIDs; links to abstracts on PubMed.
            </p>
            <p>
              <strong>Example questions:</strong>
            </p>
            <ul className="list-disc pl-4">
              <li>What recent papers cover avapritinib in systemic mastocytosis?</li>
              <li>Latest publications on KIT D816V inhibitors in mast cell disease</li>
            </ul>
            <p>
              <strong>Returns:</strong> PMID, title, and PubMed URL (bibliographic metadata — not
              full-text PDFs).
            </p>
            <p className="text-2xs text-muted">
              <strong>Limitations:</strong> Public literature only; results depend on query wording;
              no paywalled full text.
            </p>
          </ToolCard>

          <ToolCard title="ClinicalTrials.gov search" source="U.S. National Library of Medicine">
            <p>
              The U.S. registry of clinical studies — sponsors register trials with conditions,
              interventions, phases, and status.
            </p>
            <p>
              <strong>The agent can learn:</strong> whether trials are recruiting or completed; NCT
              identifiers; conditions and interventions studied.
            </p>
            <p>
              <strong>Example questions:</strong>
            </p>
            <ul className="list-disc pl-4">
              <li>Active Phase 3 trials for avapritinib in GIST</li>
              <li>Trials studying bezuclastinib in systemic mastocytosis</li>
            </ul>
            <p>
              <strong>Search by:</strong> condition, intervention, or free-text term.
            </p>
            <p className="text-2xs text-muted">
              <strong>Limitations:</strong> Registry reflects sponsor submissions, not live patient
              outcomes; geography and design vary by entry quality.
            </p>
          </ToolCard>

          <ToolCard title="openFDA search" source="U.S. Food and Drug Administration — open data">
            <p>
              openFDA exposes public FDA datasets. LandScrape focuses on <strong>drug
              enforcement</strong> records — recalls, safety-related regulatory actions, and related
              enforcement narratives.
            </p>
            <p>
              <strong>The agent can learn:</strong> recent enforcement actions, product names involved,
              classification of events relevant to market access and safety narratives.
            </p>
            <p>
              <strong>Example questions:</strong>
            </p>
            <ul className="list-disc pl-4">
              <li>Recent FDA enforcement actions involving biologics in a therapeutic area</li>
              <li>Recall or enforcement history for a product name</li>
            </ul>
            <p className="text-2xs text-muted">
              <strong>Limitations:</strong> A subset of FDA information — not a complete regulatory
              dossier or label history; use for intelligence, not submission-ready regulatory work.
            </p>
          </ToolCard>

          <ToolCard title="X search" source="X (Twitter) — via XActions">
            <p>
              Searches recent public posts on X for keywords, hashtags, or handles configured for your
              workspace. Used for professional discourse and market-moving social signals.
            </p>
            <p className="text-2xs text-muted">
              X monitoring powered by{" "}
              <a
                href="https://github.com/nirholas/xactions"
                className="text-accent-green underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                XActions
              </a>
              .
            </p>
          </ToolCard>

          <ToolCard title="Workspace signals" source="Your LandScrape tenant">
            <p>
              Searches signals already ingested into <strong>your workspace</strong> — competitor
              moves, congress highlights, alerts, connector feeds, and curated intelligence your team
              tracks.
            </p>
            <p>
              <strong>The agent can learn:</strong> what you have already seen on a topic, how themes
              cluster over time, which items matter for the current quarter.
            </p>
            <p>
              <strong>Example questions:</strong>
            </p>
            <ul className="list-disc pl-4">
              <li>What have we captured on competitor X in the last 90 days?</li>
              <li>Signals mentioning a congress session or product launch</li>
            </ul>
            <p>
              Grounds research answers in <strong>your</strong> feed, not only the open web.
            </p>
          </ToolCard>
        </div>
      </GuideSection>

      <GuideSection title="How the research agent works">
        <ol className="list-decimal space-y-2 pl-4">
          <li>You type a question on the Research page.</li>
          <li>
            The language model reads your question (and recent conversation) and decides whether it
            needs external data.
          </li>
          <li>
            If needed, it calls one or more tools — PubMed, ClinicalTrials.gov, openFDA, X search,
            workspace signals — with specific search arguments.
          </li>
          <li>Each tool returns structured JSON results (titles, IDs, URLs, trial fields, etc.).</li>
          <li>
            The model synthesizes an executive-ready answer and cites sources when tools returned
            them.
          </li>
          <li>
            If the first pass is incomplete, it may call more tools — but only for a{" "}
            <strong>bounded number of rounds</strong> so the session cannot run indefinitely.
          </li>
        </ol>

        <p className="font-medium text-stone-900">Three ways the agent helps:</p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <strong>Research chat</strong> — Interactive Q&amp;A for drugs, trials, regulatory
            updates, and competitive landscape.
          </li>
          <li>
            <strong>Executive brief</strong> — A structured markdown briefing built from recent
            workspace signals plus tool research (available from Reports / briefing actions).
          </li>
          <li>
            <strong>Signal enrichment</strong> — For important ingested signals, the agent adds a
            short paragraph linking the signal to relevant public literature or trials.
          </li>
        </ul>

        <p className="text-2xs text-muted">
          Guardrails: only the fixed public-data tool set above — no electronic health records,
          imaging systems, prior authorization workflows, or patient charts.
        </p>
      </GuideSection>

      <GuideSection title="PHI and safety">
        <p>
          LandScrape is built for <strong>L2 (Level 2) data</strong> — public, de-identified reference
          information such as journal indexes, trial registries, and open regulatory records. It is not
          a patient chart, care management, or clinical workflow system.
        </p>

        <p className="font-medium text-stone-900">Blocked by design</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Electronic health records and FHIR clinical endpoints</li>
          <li>Patient-specific records, medical record numbers, or imaging (DICOM)</li>
          <li>Prior authorization, break-glass, or hospital-internal tools</li>
          <li>Any capability not on the explicit allowlist</li>
        </ul>

        <p className="font-medium text-stone-900">Never enter in Research or search</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Social Security numbers</li>
          <li>Medical record numbers (MRN)</li>
          <li>Dates of birth tied to identifiable individuals</li>
          <li>Patient names or any patient-identifiable information</li>
        </ul>

        <p>
          Inputs are scanned for patterns that resemble PHI. Tool calls are audited with{" "}
          <strong>hashed and redacted</strong> arguments — raw sensitive text is not stored in audit
          logs.
        </p>

        <p className="rounded-soft border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
          Market intelligence only. Public L2 sources. Never enter patient-identifiable information.
        </p>

        <p className="font-medium text-stone-900">Allowed capabilities (seven paths, four sources)</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>PubMed literature search</li>
          <li>ClinicalTrials.gov search</li>
          <li>openFDA enforcement search</li>
          <li>Workspace signals search</li>
        </ul>
        <p className="text-2xs text-muted">
          Each of the three public sources is available through two equivalent integration paths (MCP
          sidecar and direct API). The agent uses one path at a time depending on platform
          configuration — you see the same capabilities either way.
        </p>
      </GuideSection>

      <GuideSection title="Search and embeddings">
        <p>
          Every signal in your workspace gets an automatic summary and an embedding vector. That powers
          the <strong>search bar</strong> at the top of the app (available on all main pages).
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-soft border border-border bg-stone-50/60 px-3 py-2">
            <p className="text-xs font-semibold text-stone-900">Keyword</p>
            <p className="mt-1 text-2xs leading-relaxed text-stone-700">
              Matches exact words in titles and summaries. Use when you know the precise drug name,
              code, or acronym.
            </p>
          </div>
          <div className="rounded-soft border border-border bg-stone-50/60 px-3 py-2">
            <p className="text-xs font-semibold text-stone-900">Semantic</p>
            <p className="mt-1 text-2xs leading-relaxed text-stone-700">
              Matches meaning via embeddings. Use for themes, mechanisms, or competitive narratives
              where wording varies.
            </p>
          </div>
          <div className="rounded-soft border border-border bg-stone-50/60 px-3 py-2">
            <p className="text-xs font-semibold text-stone-900">Hybrid</p>
            <p className="mt-1 text-2xs leading-relaxed text-stone-700">
              Combines keyword and semantic signals. A good default when you are unsure which mode fits.
            </p>
          </div>
        </div>

        <p>
          Search mode is chosen in the shell search UI. Results link through to individual signals for
          full detail, alerts, and reporting.
        </p>
      </GuideSection>

      <GuideSection title="Glossary">
        <dl className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-4">
          <GlossaryEntry
            term="MCP (Model Context Protocol)"
            definition="Open standard for assistants to list and invoke external tools in a uniform way."
          />
          <GlossaryEntry
            term="Sidecar"
            definition="A small companion service that exposes one domain of tools (e.g. PubMed) to the agent."
          />
          <GlossaryEntry
            term="L2 data"
            definition="Public, non-patient-specific reference data suitable for market intelligence."
          />
          <GlossaryEntry
            term="Embedding"
            definition="Numeric representation of text meaning, used for semantic similarity search."
          />
          <GlossaryEntry
            term="Language model"
            definition="Model that reads and generates text; powers summaries and Research chat."
          />
          <GlossaryEntry
            term="Agent turn"
            definition="One cycle of the model reasoning, optionally calling tools, before the next reply."
          />
          <GlossaryEntry
            term="Tool allowlist"
            definition="Fixed set of capabilities the agent is permitted to call; everything else is rejected."
          />
          <GlossaryEntry
            term="Inference"
            definition="Running the model on input to produce an output (summary, answer, or tool decision)."
          />
          <GlossaryEntry
            term="Signal enrichment"
            definition="Adding public-context narrative to an ingested signal after it enters the workspace."
          />
          <GlossaryEntry
            term="Executive brief"
            definition="Structured briefing document synthesizing recent signals and tool findings."
          />
        </dl>
      </GuideSection>

      <div className="rounded-soft border border-border bg-surface px-4 py-3 shadow-sm">
        <p className="text-xs text-stone-800">
          Ready to try it?{" "}
          <Link href={researchHref} className="font-medium text-accent-green underline">
            Open Research →
          </Link>
        </p>
      </div>
    </div>
  );
}
