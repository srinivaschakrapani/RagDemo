"use client";

import Link from "next/link";
import { Abbr, CodeBlock, StepThrough } from "../shared";
import type { Step } from "../shared";

const RAW_XML_SNIPPET = `<section>
  <code displayName="INDICATIONS &amp; USAGE SECTION"/>
  <title>Seizure Disorders</title>
  <text>Clonazepam is indicated as adjunctive therapy in the treatment
  of patients with Lennox-Gastaut syndrome...</text>
</section>`;

const CORPUS_RECORD = `{
  "id": 42,
  "drug_name": "Clonazepam",
  "category": "prescription",
  "section": "Indications & Usage – Seizure Disorders",
  "text": "Clonazepam is indicated as adjunctive therapy in the treatment
of patients with Lennox-Gastaut syndrome..."
}`;

const TOC_ENTRY = `{
  "title": "Indications & Usage",
  "children": ["Seizure Disorders", "Panic Disorder"],
  "passage_ids": [42, 43]
}`;

type StorageRow = {
  artifact: string;
  builtBy: string;
  when: string;
  storedAt: string;
  persisted: boolean;
};

const STORAGE_ROWS: StorageRow[] = [
  {
    artifact: "ragdemo_corpus.jsonl",
    builtBy: "spl_corpus_build.py",
    when: "Offline, once (rerun when the label manifest changes)",
    storedAt: "Modal Volume ragdemo-index, mounted at /data → /data/ragdemo_corpus.jsonl",
    persisted: true,
  },
  {
    artifact: "pageindex.json",
    builtBy: "pageindex_build.py",
    when: "Offline, once (rerun when the corpus changes)",
    storedAt: "Same Volume → /data/pageindex.json",
    persisted: true,
  },
  {
    artifact: "MiniLM embeddings + FAISS index",
    builtBy: "VectorRAG.load() (app.py, @modal.enter)",
    when: "Runtime — every container cold start",
    storedAt: "In memory only, inside the running container",
    persisted: false,
  },
  {
    artifact: "2D PCA projection (for the scatter plot)",
    builtBy: "VectorRAG.load() (app.py, @modal.enter)",
    when: "Runtime — every container cold start",
    storedAt: "In memory only, inside the running container",
    persisted: false,
  },
];

type LlmCallRow = {
  step: string;
  when: string;
  given: string;
  returns: string;
};

const LLM_CALL_ROWS: LlmCallRow[] = [
  {
    step: "select_document",
    when: "Query time, step 1",
    given: "The question + every drug's name and category from pageindex.json",
    returns: "The single drug name the question is about (strict JSON)",
  },
  {
    step: "select_sections",
    when: "Query time, step 2",
    given: "The question + that one drug's top-level section titles only",
    returns: "Up to 2 section titles to open",
  },
  {
    step: "generate",
    when: "Query time, step 4 (after fetch_content, which is a pure lookup — no LLM)",
    given: "The fetched section text + the question",
    returns: "The final answer",
  },
];

export default function DataPreparationPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--chunking)" }}>
          Data Preparation
        </h1>
        <p className="mt-1 text-sm leading-6 text-foreground/70">
          Before either lane can answer a single question, the same raw SPL XML has to be turned
          into a format an LLM (or a vector index) can actually use. This is that pipeline, start
          to finish — where{" "}
          <Link href="/vector" className="underline decoration-dotted underline-offset-2" style={{ color: "var(--vector)" }}>
            Vector RAG
          </Link>{" "}
          and{" "}
          <Link href="/pageindex" className="underline decoration-dotted underline-offset-2" style={{ color: "var(--pageindex)" }}>
            Vectorless RAG
          </Link>{" "}
          share a starting point, where they diverge, and exactly which steps involve an LLM call
          and which don&apos;t.
        </p>
      </div>

      <StepThrough steps={buildSteps()} color="chunking" resetKey="static" />
    </div>
  );
}

function buildSteps(): Step[] {
  return [
    {
      id: "raw-xml",
      label: "1. Raw XML",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            Every drug label starts as one HL7 v3 SPL XML document — a{" "}
            <code>&lt;structuredBody&gt;</code> of repeating <code>&lt;section&gt;</code> blocks,
            each carrying a LOINC-coded <code>displayName</code> and its prose in{" "}
            <code>&lt;text&gt;</code>. Full anatomy on{" "}
            <Link href="/about-data" className="underline decoration-dotted underline-offset-2">
              About Data
            </Link>
            . This is the one input both lanes read — nothing downstream of this step sees the raw
            XML again.
          </p>
          <CodeBlock>{RAW_XML_SNIPPET}</CodeBlock>
        </div>
      ),
    },
    {
      id: "extract",
      label: "2. Extract & filter",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            <code>spl_corpus_build.py</code> walks each document&apos;s section tree with{" "}
            <code>lxml</code>, keeps only the clinically load-bearing sections (indications,
            dosage, warnings, contraindications, interactions, and their OTC Drug-Facts
            equivalents), and drops boilerplate (packaging, storage/handling, contact info). No LLM
            involved — this is a rules-based parse, matching each section&apos;s{" "}
            <code>displayName</code> against a fixed keyword list.
          </p>
          <p>
            One flat record comes out per kept section: drug name, category, section label, and the
            section&apos;s own text (word-capped, table-like passages dropped). A recursive walk
            also catches labels that nest real prose one level below an unlabeled parent section
            (e.g. Clonazepam&apos;s &quot;Seizure Disorders&quot; / &quot;Panic Disorder&quot;
            children under Indications &amp; Usage).
          </p>
        </div>
      ),
    },
    {
      id: "target-format",
      label: "3. Target format",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            The output is <code>ragdemo_corpus.jsonl</code> — one JSON object per line, one line
            per kept section. This is the single target format both lanes are built from; nothing
            past this point ever re-reads the original XML.
          </p>
          <CodeBlock>{CORPUS_RECORD}</CodeBlock>
          <p className="text-[11px] leading-5 text-foreground/50">
            Built once, locally, then pushed straight to the Modal Volume with{" "}
            <code>modal volume put ragdemo-index</code> — no deploy needed to update the corpus.
          </p>
        </div>
      ),
    },
    {
      id: "fork",
      label: "4. Two paths diverge",
      content: (
        <div className="flex flex-col gap-4">
          <p>
            From the same <code>ragdemo_corpus.jsonl</code>, the two lanes prepare completely
            different query-time structures — and only one of them ever calls an LLM to do it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-surface-border bg-background/30 p-3">
              <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--vector)" }}>
                Vector RAG
              </p>
              <p className="text-xs leading-5 text-foreground/70">
                Every passage is embedded with MiniLM (384-dim, L2-normalized) and loaded into an
                in-memory FAISS <code>IndexFlatIP</code> index. This happens at{" "}
                <strong>runtime</strong>, freshly on every container cold start — not offline, and
                nothing is written back to disk. See the{" "}
                <Link href="/chunking" className="underline decoration-dotted underline-offset-2">
                  Chunking
                </Link>{" "}
                tab for how structure-aware splitting (docling) motivates the one-passage-per-section
                shape already baked into step 2.
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-background/30 p-3">
              <p className="mb-1.5 text-xs font-bold" style={{ color: "var(--pageindex)" }}>
                Vectorless RAG
              </p>
              <p className="text-xs leading-5 text-foreground/70">
                No embeddings. <code>pageindex_build.py</code> regroups each drug&apos;s existing
                section labels into a two-level{" "}
                <Abbr term="ToC" expansion="Table of Contents" /> — built <strong>offline</strong>,
                once, upfront, well before any question is asked. Next step covers this in detail.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "toc-build",
      label: "5. Vectorless: building the ToC",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            <code>pageindex_build.py</code> groups passages by drug, then by section. Sections
            already named like <code>&quot;Adverse Reactions – 6.1 Clinical Studies
            Experience&quot;</code> split on the en dash into a parent (&quot;Adverse
            Reactions&quot;) and a numbered child; sections with no dash (e.g.
            &quot;Contraindications&quot;) become parent-only entries. Every passage ID under a
            parent — children included — is kept together, so fetching that parent later always
            returns the whole section regardless of how finely DailyMed split it.
          </p>
          <CodeBlock>{TOC_ENTRY}</CodeBlock>
          <p>
            <strong>This step uses zero LLM calls.</strong> The ToC is nothing but the corpus&apos;s
            own section titles, reorganized — there is no summarizing, no classification, no model
            in the loop. It runs as a Modal batch job (<code>modal run
            modal/pageindex_build.py</code>), writes <code>pageindex.json</code> back to the same
            Volume, and is done well before the first question ever arrives.
          </p>
        </div>
      ),
    },
    {
      id: "llm-calls",
      label: "6. LLM calls in Vectorless",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            The LLM only enters the Vectorless lane <strong>after</strong> the ToC already exists —
            at query time, reasoning over it. All calls hit the same self-hosted Gemma 4 2B (
            <code>GemmaGenerator</code> in <code>app.py</code>, running on an A10G — no external
            API):
          </p>
          <div className="overflow-x-auto rounded-lg border border-surface-border">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-background/40 text-foreground/50">
                  <th className="px-2.5 py-2 font-medium">Call</th>
                  <th className="px-2.5 py-2 font-medium">When</th>
                  <th className="px-2.5 py-2 font-medium">Given</th>
                  <th className="px-2.5 py-2 font-medium">Returns</th>
                </tr>
              </thead>
              <tbody>
                {LLM_CALL_ROWS.map((r) => (
                  <tr key={r.step} className="border-b border-surface-border last:border-0">
                    <td className="px-2.5 py-2 font-mono text-foreground/80">{r.step}</td>
                    <td className="px-2.5 py-2 text-foreground/60">{r.when}</td>
                    <td className="px-2.5 py-2 text-foreground/60">{r.given}</td>
                    <td className="px-2.5 py-2 text-foreground/60">{r.returns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] leading-5 text-foreground/50">
            That&apos;s up to 3 LLM calls per question — 2 cheap reasoning calls over titles/names,
            plus 1 generation call shared with every other lane. See the full step-by-step trace on{" "}
            <Link href="/pageindex" className="underline decoration-dotted underline-offset-2" style={{ color: "var(--pageindex)" }}>
              Vectorless RAG
            </Link>
            .
          </p>
        </div>
      ),
    },
    {
      id: "storage",
      label: "7. Where it all lives",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            Everything offline lands on one shared Modal Volume (<code>ragdemo-index</code>,
            mounted at <code>/data</code> in every container). Nothing runtime-only is ever
            persisted:
          </p>
          <div className="overflow-x-auto rounded-lg border border-surface-border">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-background/40 text-foreground/50">
                  <th className="px-2.5 py-2 font-medium">Artifact</th>
                  <th className="px-2.5 py-2 font-medium">Built by</th>
                  <th className="px-2.5 py-2 font-medium">When</th>
                  <th className="px-2.5 py-2 font-medium">Stored at</th>
                  <th className="px-2.5 py-2 font-medium">Persisted?</th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_ROWS.map((r) => (
                  <tr key={r.artifact} className="border-b border-surface-border last:border-0">
                    <td className="px-2.5 py-2 text-foreground/80">{r.artifact}</td>
                    <td className="px-2.5 py-2 font-mono text-foreground/60">{r.builtBy}</td>
                    <td className="px-2.5 py-2 text-foreground/60">{r.when}</td>
                    <td className="px-2.5 py-2 text-foreground/60">{r.storedAt}</td>
                    <td className="px-2.5 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: r.persisted ? "var(--pageindex)" : "var(--surface-border)" }}
                      >
                        {r.persisted ? "yes" : "no"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] leading-5 text-foreground/50">
            Both <code>ragdemo_corpus.jsonl</code> and <code>pageindex.json</code> are read fresh by
            every container at cold start — there&apos;s no database in front of either, per the
            demo&apos;s own &quot;no dedicated db&quot; constraint. Re-running either build script
            just overwrites its file on the Volume; every new container picks it up automatically.
          </p>
        </div>
      ),
    },
  ];
}
