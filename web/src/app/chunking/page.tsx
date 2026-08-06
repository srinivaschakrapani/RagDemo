"use client";

import { useEffect, useState } from "react";
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

function buildChunkingSteps(example: ChunkingExample): Step[] {
  const rawPreview = example.sections.map((s) => `[${s.section}] ${s.text}`).join("\n\n");

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
      id: "boundaries",
      label: "Raw label",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            The actual sections docling worked from, for reference — this is what got parsed out of
            the raw SPL XML in Phase 0 before chunking ever ran.
          </p>
          <CodeBlock>{rawPreview.length > 2000 ? rawPreview.slice(0, 2000) + " …" : rawPreview}</CodeBlock>
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
            The Vector RAG tab uses this same one-passage-per-section idea (see modal/
            spl_corpus_build.py) to build the 598-passage corpus it embeds into FAISS — structure-
            aware chunking isn&apos;t just tidier, it&apos;s what keeps each retrieved passage about
            one fact instead of a blend of several.
          </p>
        </div>
      ),
    },
  ];
}
