"use client";

import { useState } from "react";
import TocView from "./toc-view";
import {
  Abbr,
  AskBox,
  CodeBlock,
  EXAMPLE_QUESTIONS,
  PAGEINDEX_LOADING_MESSAGES,
  Spinner,
  StepThrough,
  useRotatingMessage,
} from "../shared";
import type { Step } from "../shared";
import { parseApiResponse } from "@/lib/api";
import type { PageIndexRAGResponse } from "@/lib/types";

// Fixed backend constants (modal/config.py) — not per-request data, safe to show as-is.
const GEMMA_MAX_NEW_TOKENS = 200;
const PAGEINDEX_MAX_SECTIONS = 2;

export default function PageIndexPage() {
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PageIndexRAGResponse | null>(null);
  const [askCount, setAskCount] = useState(0);
  const loadingMessage = useRotatingMessage(PAGEINDEX_LOADING_MESSAGES, loading);

  async function onAsk(q?: string) {
    const asked = (q ?? question).trim();
    if (!asked || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/rag-pageindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: asked }),
      });
      const data = await parseApiResponse<PageIndexRAGResponse>(res);
      setResult(data);
      setAskedQuestion(asked);
      setAskCount((c) => c + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "something went wrong — the model may be cold-starting, try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--pageindex)" }}>
          Vectorless RAG
        </h1>
        <p className="mt-1 text-sm leading-6 text-foreground/70">
          No embeddings, no vector index. An offline pass groups every drug label&apos;s own
          section titles into a table of contents (<Abbr term="ToC" expansion="Table of Contents" />).
          Ask something, then step through how Gemma reasons over that ToC to pick a document,
          then a section, then reads its full text.
          This demo implements that idea with{" "}
          <a
            href="https://github.com/VectifyAI/PageIndex"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2"
          >
            PageIndex
          </a>
          , a reasoning-based retrieval method built exactly for this: search by document structure
          instead of vector similarity.
        </p>
      </div>

      <AskBox
        question={question}
        setQuestion={setQuestion}
        onAsk={() => onAsk()}
        loading={loading}
        examples={EXAMPLE_QUESTIONS}
        onExample={(ex) => {
          setQuestion(ex);
          onAsk(ex);
        }}
        color="pageindex"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-foreground/60">
          <Spinner color="pageindex" />
          <span key={loadingMessage} className="animate-fade-in-up">
            {loadingMessage}
          </span>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-2 animate-fade-in-up">
          <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
            How this answer was produced
          </p>
          <StepThrough steps={buildPageIndexSteps(result, askedQuestion)} color="pageindex" resetKey={askCount} />
        </div>
      )}
    </div>
  );
}

function buildPageIndexSteps(result: PageIndexRAGResponse, askedQuestion: string): Step[] {
  const passage = result.facts.join("\n\n");
  const docStep = result.trace.find((s) => s.action === "select_document");
  const secStep = result.trace.find((s) => s.action === "select_sections");
  const docViaGemma = docStep?.args?.via === "gemma";
  const secViaGemma = secStep?.args?.via === "gemma";

  return [
    {
      id: "toc-built",
      label: "ToC built (offline)",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            Before any question arrives, an offline batch job (<code>pageindex_build.py</code>)
            reads the corpus (<code>ragdemo_corpus.jsonl</code>) once and regroups every drug
            label&apos;s own section titles into a two-level table of contents per drug — no LLM
            call needed for this part, since it&apos;s just the corpus&apos;s existing titles,
            reorganized. The result is saved to <code>pageindex.json</code>, on the same Modal
            Volume as the corpus. Everything below reasons over that pre-built file.
          </p>
        </div>
      ),
    },
    {
      id: "ask",
      label: "Ask",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            No index exists to search — the question goes straight to document selection against
            the pre-built table of contents.
          </p>
          <CodeBlock>{JSON.stringify({ question: askedQuestion }, null, 2)}</CodeBlock>
        </div>
      ),
    },
    {
      id: "select-document",
      label: "Select document",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            {docViaGemma ? (
              <>
                The self-hosted Gemma 4 2B model reads the question plus every drug&apos;s name and
                category, and picks the single document it&apos;s about — a reasoning step, not a
                similarity search. Concretely: it&apos;s handed a plain bulleted list like{" "}
                <code>- {result.matched_document ?? "Drug Name"} (category)</code> for every label
                in the corpus, plus the question, and told to return strict JSON —{" "}
                <code>{"{"}&quot;drug_name&quot;: &quot;...&quot;{"}"}</code> — naming its pick
                verbatim. The app then just parses that JSON straight out of Gemma&apos;s raw text
                output; no separate classifier or search index is involved.
              </>
            ) : (
              <>
                The question&apos;s words are matched directly against drug names by word overlap —
                this run fell back to that (the model call failed or timed out), which is exactly
                why the fallback exists.
              </>
            )}
          </p>
          {result.matched_document ? (
            <>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
                  Source document selected
                </p>
                <span
                  className="w-fit rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
                  style={{ background: "var(--pageindex)" }}
                >
                  {result.matched_document}
                </span>
              </div>
              {result.toc && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
                    The data this unlocks — {result.matched_document}&apos;s own {result.toc.length}{" "}
                    top-level section{result.toc.length === 1 ? "" : "s"}
                  </p>
                  <TocView drugName={result.matched_document} sections={result.toc} matchedTitles={[]} />
                </div>
              )}
            </>
          ) : (
            <p className="italic text-foreground/50">No document matches this question.</p>
          )}
        </div>
      ),
    },
    {
      id: "select-sections",
      label: "Select section(s)",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            {secViaGemma ? (
              <>
                Gemma reads just this one document&apos;s top-level section titles — not the full
                text — and picks up to {PAGEINDEX_MAX_SECTIONS} that would contain the answer.
              </>
            ) : (
              <>
                Section titles are matched directly against the question by word overlap — this run
                fell back to that.
              </>
            )}
          </p>
          {result.toc && result.matched_document ? (
            <TocView
              drugName={result.matched_document}
              sections={result.toc}
              matchedTitles={result.matched_sections}
            />
          ) : (
            <p className="italic text-foreground/50">No section matches — no document was selected.</p>
          )}
        </div>
      ),
    },
    {
      id: "fetch-content",
      label: "Fetch content",
      content:
        result.facts.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p>
              The full passage text under the chosen section(s) — numbered subsections included —
              is read as-is, no summarizing or chunking.
            </p>
            <ul className="flex flex-col gap-1.5">
              {result.facts.map((fact, i) => (
                <li key={i} className="rounded-lg border border-surface-border bg-background/30 p-2.5 text-xs">
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="italic text-foreground/50">
            No content fetched — either no document or no section matched. It answers ungrounded,
            or declines.
          </p>
        ),
    },
    {
      id: "generate",
      label: "Generate",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            The fetched section text is sent to the same self-hosted Gemma 4 2B model the other
            two lanes call — identical generator, so any difference in the final answer comes from
            retrieval alone.
          </p>
          <CodeBlock>
            {JSON.stringify(
              {
                passage: passage || "(none — no content to ground the answer in)",
                question: askedQuestion,
                max_new_tokens: GEMMA_MAX_NEW_TOKENS,
              },
              null,
              2
            )}
          </CodeBlock>
        </div>
      ),
    },
    {
      id: "result",
      label: "Result",
      content: (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
            Gemma&apos;s answer
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{result.answer}</p>
          <p className="mt-2 border-t border-surface-border pt-2 text-[11px] text-foreground/40">
            {(result.timing_ms / 1000).toFixed(1)}s end-to-end · {result.facts.length} section
            {result.facts.length === 1 ? "" : "s"}&apos; worth of passages · ~{result.tokens_used}{" "}
            tokens · {result.llm_calls} LLM call{result.llm_calls === 1 ? "" : "s"}
          </p>
          <p className="text-[11px] leading-5 text-foreground/50">
            Gemma 4 2B was called for:{" "}
            {[
              docViaGemma && "picking the document",
              secViaGemma && "picking the section(s)",
              "generating this answer",
            ]
              .filter(Boolean)
              .join(", ")}
            . The ToC build itself used no LLM at all.
          </p>
        </div>
      ),
    },
  ];
}
