"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CodeBlock, StepThrough } from "../shared";
import type { Step } from "../shared";

type SectionRecord = { section: string; text: string };
type NaiveChunk = { text: string; word_count: number };
type DoclingChunk = { text: string; word_count: number; headings: string[] };
type ChunkingExample = {
  drug_name: string;
  sections: SectionRecord[];
  raw_word_count: number;
  markdown: string;
  naive_chunks: NaiveChunk[];
  docling_chunks: DoclingChunk[];
};

const NAIVE_WINDOW_WORDS = 60;

export default function ChunkingPage() {
  const [examples, setExamples] = useState<ChunkingExample[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    fetch("/chunking-examples.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setExamples)
      .catch((e) => setError(e instanceof Error ? e.message : "failed to load examples"));
  }, []);

  const example = examples?.[selected];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--chunking)" }}>
          Chunking
        </h1>
        <p className="mt-1 text-sm leading-6 text-foreground/70">
          Before anything can be embedded or graphed, a document has to be split into pieces small
          enough to retrieve individually. This step is run once, offline, on real DailyMed drug
          labels using <a href="https://docling-project.github.io/docling/" target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">docling</a> — pick a label below and step through it.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {examples && (
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex, i) => (
            <button
              key={ex.drug_name}
              onClick={() => setSelected(i)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderColor: i === selected ? "var(--chunking)" : "var(--surface-border)",
                background: i === selected ? "var(--chunking)" : "transparent",
                color: i === selected ? "white" : "var(--foreground)",
                opacity: i === selected ? 1 : 0.7,
              }}
            >
              {ex.drug_name}
            </button>
          ))}
        </div>
      )}

      {example && (
        <StepThrough
          steps={buildChunkingSteps(example)}
          color="chunking"
          resetKey={example.drug_name}
        />
      )}

      {!examples && !error && <p className="text-sm text-foreground/50">Loading worked examples…</p>}
    </div>
  );
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildXmlExcerpt(example: ChunkingExample): string {
  const target =
    example.sections.find((s) => s.section.toLowerCase().startsWith("indications & usage")) ??
    example.sections[0];
  const isIndications = target.section.toLowerCase().startsWith("indications & usage");
  const codeAttr = isIndications
    ? ` code="34067-9" displayName="INDICATIONS &amp; USAGE SECTION"`
    : "";
  const textPreview = escapeXml(target.text.length > 400 ? target.text.slice(0, 400) + " …" : target.text);
  const otherCount = example.sections.length - 1;

  return `<document xmlns="urn:hl7-org:v3">
  <title>${escapeXml(example.drug_name)}</title>
  <!-- id / setId / versionNumber / author: identity + manufacturer metadata, omitted here -->
  <component>
    <structuredBody>
      <component>
        <section>
          <code${codeAttr}/>
          <title>${escapeXml(target.section)}</title>
          <text>${textPreview}</text>
        </section>
      </component>
      <!-- ...${otherCount} more <component><section> block${otherCount === 1 ? "" : "s"}, one per kept section... -->
    </structuredBody>
  </component>
</document>`;
}

function buildChunkingSteps(example: ChunkingExample): Step[] {
  const rawPreview = example.sections.map((s) => `[${s.section}] ${s.text}`).join("\n\n");
  const xmlExcerpt = buildXmlExcerpt(example);

  return [
    {
      id: "why",
      label: "Why chunk?",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            An LLM prompt has a limited context window, and retrieval works best when a passage is
            about <em>one thing</em> — so before a document can be embedded (Vector RAG) or grouped
            into a table of contents (PageIndex RAG), it has to be split into smaller, individually
            retrievable pieces.
          </p>
          <p>
            <strong>{example.drug_name}</strong>&apos;s full label is{" "}
            <strong>{example.raw_word_count.toLocaleString()} words</strong> across{" "}
            {example.sections.length} sections — far too much to hand an LLM as one block for a
            single-fact question, and far too coarse to embed as one vector.
          </p>
        </div>
      ),
    },
    {
      id: "raw-data",
      label: "The raw XML",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            Before any splitting strategy runs, here&apos;s where the data actually starts: one kept
            section from <strong>{example.drug_name}</strong>&apos;s real SPL label, in the same HL7
            v3 XML shape covered on the{" "}
            <Link href="/about-data" className="underline decoration-dotted underline-offset-2">
              About Data
            </Link>{" "}
            page.
          </p>
          <CodeBlock>{xmlExcerpt}</CodeBlock>
          <p className="text-[11px] leading-5 text-foreground/50">
            This section already survived an earlier, offline preprocessing pass over the raw SPL
            XML — one that drops boilerplate (packaging metadata, storage instructions, contact
            info) and keeps only clinically load-bearing sections. See{" "}
            <Link href="/about-data" className="underline decoration-dotted underline-offset-2">
              About Data
            </Link>{" "}
            for the full kept-vs-dropped table.
          </p>
          <p className="text-[11px] leading-5 text-foreground/50">
            Parsing pulls every kept section out of XML like this into flat records — this is what
            actually gets reassembled into Markdown and handed to docling, all{" "}
            {example.sections.length} of them:
          </p>
          <CodeBlock>{rawPreview.length > 1200 ? rawPreview.slice(0, 1200) + " …" : rawPreview}</CodeBlock>
        </div>
      ),
    },
    {
      id: "naive",
      label: "Naive split",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            The simplest approach: cut every {NAIVE_WINDOW_WORDS} words, ignoring structure
            entirely. Fast and simple, but boundaries land wherever the word count runs out — often
            mid-sentence, and sometimes mid-<em>section</em>, splicing two unrelated facts into one
            chunk or one fact across two.
          </p>
          <ul className="flex flex-col gap-2">
            {example.naive_chunks.slice(0, 4).map((c, i) => (
              <li key={i} className="rounded-lg border border-surface-border bg-background/30 p-2.5 text-xs leading-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
                  chunk {i + 1} · {c.word_count} words
                </p>
                {c.text}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-foreground/50">
            {example.naive_chunks.length} naive chunks total — none of them know which SPL section
            they came from.
          </p>
        </div>
      ),
    },
    {
      id: "structure",
      label: "Structure-aware",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            docling instead parses the document&apos;s actual structure — headings, sections,
            sub-sections — into a hierarchical document model first, <em>then</em> chunks along
            those boundaries with its <code>HybridChunker</code>. A chunk never straddles two
            sections; when a section itself has sub-headings (like Clonazepam&apos;s separate
            &quot;Seizure Disorders&quot; and &quot;Panic Disorder&quot; indications), each keeps
            its own heading path.
          </p>
          <ul className="flex flex-col gap-2">
            {example.docling_chunks.slice(0, 4).map((c, i) => (
              <li key={i} className="rounded-lg border border-surface-border bg-background/30 p-2.5 text-xs leading-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--chunking)" }}>
                  {c.headings.join(" › ")} · {c.word_count} words
                </p>
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "result",
      label: "Result",
      content: (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
            Final chunk set for this label
          </p>
          <p className="text-sm leading-6 text-foreground">
            {example.docling_chunks.length} structure-aware chunks (vs. {example.naive_chunks.length}{" "}
            naive fixed-size ones) — sizes ranging{" "}
            {Math.min(...example.docling_chunks.map((c) => c.word_count))}–
            {Math.max(...example.docling_chunks.map((c) => c.word_count))} words, each tagged with
            its section heading.
          </p>
          <p className="mt-2 border-t border-surface-border pt-2 text-[11px] leading-5 text-foreground/50">
            Structure-aware chunking isn&apos;t just tidier — it&apos;s what keeps each retrieved
            passage about one fact instead of a blend of several. The real corpus build (
            <code>spl_corpus_build.py</code>) uses this same one-passage-per-section idea and saves
            the result to <code>ragdemo_corpus.jsonl</code> — the file every Vector RAG container
            reads on startup.
          </p>
        </div>
      ),
    },
  ];
}
