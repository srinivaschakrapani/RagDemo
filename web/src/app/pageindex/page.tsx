"use client";

import { useState } from "react";
import TocView from "./toc-view";
import {
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
          PageIndex RAG
        </h1>
        <p className="mt-1 text-sm leading-6 text-foreground/70">
          No embeddings, no graph. An offline pass groups every drug label&apos;s own section
          titles into a table of contents. Ask something, then step through how Gemma reasons
          over that ToC to pick a document, then a section, then reads its full text.
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
                similarity search.
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
            <span
              className="w-fit rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
              style={{ background: "var(--pageindex)" }}
            >
              {result.matched_document}
            </span>
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
        </div>
      ),
    },
  ];
}
