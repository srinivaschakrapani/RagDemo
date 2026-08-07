"use client";

import { useState } from "react";
import {
  Abbr,
  Accordion,
  AskBox,
  EXAMPLE_QUESTIONS,
  Expandable,
  ObservationDetail,
  PAGEINDEX_LOADING_MESSAGES,
  Spinner,
  TRACE_ACTION_LABELS,
  VECTOR_LOADING_MESSAGES,
  useRotatingMessage,
} from "../shared";
import type { AccordionItem } from "../shared";
import { parseApiResponse } from "@/lib/api";
import type { PageIndexRAGResponse, VectorRAGResponse } from "@/lib/types";

type Status = "idle" | "loading" | "done" | "error";

const PAGEINDEX_EDGE_CASE_QUESTION =
  "What adverse reactions have been reported for Amlodipine in both clinical trials and after it was marketed?";

export default function ComparePage() {
  const [question, setQuestion] = useState("");
  const [vectorStatus, setVectorStatus] = useState<Status>("idle");
  const [pageindexStatus, setPageindexStatus] = useState<Status>("idle");
  const [vectorResult, setVectorResult] = useState<VectorRAGResponse | null>(null);
  const [pageindexResult, setPageindexResult] = useState<PageIndexRAGResponse | null>(null);
  const [vectorError, setVectorError] = useState("");
  const [pageindexError, setPageindexError] = useState("");

  const loading = vectorStatus === "loading" || pageindexStatus === "loading";
  const vectorLoadingMessage = useRotatingMessage(VECTOR_LOADING_MESSAGES, vectorStatus === "loading");
  const pageindexLoadingMessage = useRotatingMessage(PAGEINDEX_LOADING_MESSAGES, pageindexStatus === "loading");

  async function onAsk(q?: string, vectorTopK = 5) {
    const asked = (q ?? question).trim();
    if (!asked || loading) return;

    setVectorStatus("loading");
    setPageindexStatus("loading");
    setVectorResult(null);
    setPageindexResult(null);
    setVectorError("");
    setPageindexError("");

    fetch("/api/rag-vector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: asked, top_k: vectorTopK }),
    })
      .then((res) => parseApiResponse<VectorRAGResponse>(res))
      .then((data) => {
        setVectorResult(data);
        setVectorStatus("done");
      })
      .catch((e) => {
        setVectorError(e instanceof Error ? e.message : "something went wrong");
        setVectorStatus("error");
      });

    fetch("/api/rag-pageindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: asked }),
    })
      .then((res) => parseApiResponse<PageIndexRAGResponse>(res))
      .then((data) => {
        setPageindexResult(data);
        setPageindexStatus("done");
      })
      .catch((e) => {
        setPageindexError(e instanceof Error ? e.message : "something went wrong");
        setPageindexStatus("error");
      });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="bg-gradient-to-r from-vector to-pageindex bg-clip-text text-2xl font-bold text-transparent">
          Compare, side by side
        </h1>
        <p className="mt-1 text-sm leading-6 text-foreground/70">
          Same question, fired at both retrieval strategies in parallel, same downstream Gemma
          generator. Differences below come entirely from retrieval.
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
        color="accent"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <ResultColumn
          color="vector"
          title="Classic RAG"
          status={vectorStatus}
          error={vectorError}
          loadingMessage={vectorLoadingMessage}
          timingMs={vectorResult?.timing_ms}
          tokensUsed={vectorResult?.tokens_used}
          llmCalls={vectorResult?.llm_calls}
          extraStat={vectorResult ? `${vectorResult.chunks.length} chunks by similarity` : undefined}
          answer={vectorResult?.answer}
        />
        <ResultColumn
          color="pageindex"
          title="Vectorless RAG"
          status={pageindexStatus}
          error={pageindexError}
          loadingMessage={pageindexLoadingMessage}
          timingMs={pageindexResult?.timing_ms}
          tokensUsed={pageindexResult?.tokens_used}
          llmCalls={pageindexResult?.llm_calls}
          extraStat={pageindexResult?.matched_document ? `matched "${pageindexResult.matched_document}"` : undefined}
          answer={pageindexResult?.answer}
        />
      </div>

      {(vectorResult || pageindexResult) && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-foreground/50 uppercase">
            Step-by-step data
          </p>
          <p className="mb-3 text-[11px] leading-4 text-foreground/50">
            The actual chunks and tool calls behind each answer above — expand a step on any side
            to see exactly what data it saw.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--vector)" }}>
                Classic RAG
              </p>
              {vectorResult ? (
                <Accordion color="vector" items={buildVectorSteps(vectorResult)} />
              ) : (
                <p className="text-xs text-foreground/40">No result yet.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--pageindex)" }}>
                Vectorless RAG
              </p>
              {pageindexResult ? (
                <Accordion color="pageindex" items={buildPageIndexSteps(pageindexResult)} />
              ) : (
                <p className="text-xs text-foreground/40">No result yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {(vectorResult || pageindexResult) && <TradeoffsTable />}

      <div className="rounded-2xl border border-surface-border bg-surface p-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-foreground/50 uppercase">
          Edge case: a section split across subsections
        </p>
        <p className="mb-3 text-[11px] leading-5 text-foreground/60">
          Amlodipine&apos;s Adverse Reactions section has two DailyMed subsections — 6.1 (clinical
          trials) and 6.2 (postmarketing) — stored as separate corpus passages. To make the
          difference visible, this button runs Vector RAG at{" "}
          <code className="rounded bg-background/60 px-1 py-0.5">top_k=1</code>: it retrieves only
          the single most-similar passage (6.1 clinical trials) and misses 6.2 postmarketing.
          Vectorless RAG instead fetches every passage filed under the parent section as one unit,
          so both subsections are always included together — watch the two answers diverge.
        </p>
        <button
          onClick={() => {
            setQuestion(PAGEINDEX_EDGE_CASE_QUESTION);
            onAsk(PAGEINDEX_EDGE_CASE_QUESTION, 1);
          }}
          disabled={loading}
          className="rounded-full border border-surface-border px-2.5 py-1 text-[11px] text-foreground/60 transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-40"
        >
          {PAGEINDEX_EDGE_CASE_QUESTION}
        </button>
      </div>
    </div>
  );
}

function ResultColumn({
  color,
  title,
  status,
  error,
  loadingMessage,
  timingMs,
  tokensUsed,
  llmCalls,
  extraStat,
  answer,
}: {
  color: "vector" | "pageindex";
  title: string;
  status: Status;
  error: string;
  loadingMessage: string;
  timingMs?: number;
  tokensUsed?: number;
  llmCalls?: number;
  extraStat?: string;
  answer?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface p-4">
      <h2 className="text-sm font-bold" style={{ color: `var(--${color})` }}>
        {title}
      </h2>

      {status === "idle" && <p className="text-xs text-foreground/40">Ask a question to begin.</p>}

      {status === "loading" && (
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          <Spinner color={color} />
          <span key={loadingMessage} className="animate-fade-in-up">
            {loadingMessage}
          </span>
        </div>
      )}

      {status === "error" && <p className="text-xs text-red-500">{error}</p>}

      {status === "done" && (
        <div className="animate-fade-in-up">
          <p className="text-sm leading-6 whitespace-pre-wrap text-foreground">{answer}</p>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-surface-border pt-2 text-[11px] text-foreground/50">
            <span>{((timingMs ?? 0) / 1000).toFixed(1)}s</span>
            <span>· ~{tokensUsed ?? 0} tokens</span>
            <span>
              · {llmCalls ?? 0} LLM call{llmCalls === 1 ? "" : "s"}
            </span>
            {extraStat && <span>· {extraStat}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function buildVectorSteps(result: VectorRAGResponse): AccordionItem[] {
  const passageSentToGemma = result.chunks.map((c) => c.text).join("\n\n");
  return [
    {
      id: "embed",
      title: "1. Embed query",
      content: (
        <p>
          Question embedded into a 384-dim vector (MiniLM, L2-normalized), then projected to 2D
          at ({result.query_point_2d.x.toFixed(3)}, {result.query_point_2d.y.toFixed(3)}) for the
          scatter plot on the vector page.
        </p>
      ),
    },
    {
      id: "retrieve",
      title: `2. Retrieve top-${result.chunks.length} by similarity`,
      content: (
        <ul className="flex flex-col gap-3">
          {result.chunks.map((c) => (
            <li key={c.id}>
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-foreground/40">
                <span>
                  #{c.id} · {c.drug_name} · {c.section}
                </span>
                <span className="font-semibold" style={{ color: "var(--vector)" }}>
                  score {c.score.toFixed(3)}
                </span>
              </div>
              <Expandable text={c.text} lines={3} />
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "generate",
      title: "3. Generate answer",
      content: (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
            Passage handed to Gemma
          </p>
          <Expandable text={passageSentToGemma} lines={4} />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">Answer</p>
          <p className="whitespace-pre-wrap font-medium text-foreground">{result.answer}</p>
        </div>
      ),
    },
  ];
}

function buildPageIndexSteps(result: PageIndexRAGResponse): AccordionItem[] {
  const traceItems: AccordionItem[] = result.trace.map((step, i) => {
    const argBits: string[] = [];
    if ("question" in step.args) argBits.push(`question="${String(step.args.question)}"`);
    if ("drug_name" in step.args) argBits.push(`drug_name="${String(step.args.drug_name)}"`);
    if ("sections" in step.args) argBits.push(`sections=${(step.args.sections as unknown[]).length}`);
    return {
      id: `step-${i}`,
      title: (
        <span>
          {i + 1}. {TRACE_ACTION_LABELS[step.action] ?? step.action}
          {argBits.length > 0 && <span className="ml-1.5 font-mono text-[10px] text-foreground/40">{argBits.join(" ")}</span>}
        </span>
      ),
      content: <ObservationDetail observation={step.observation} />,
    };
  });

  const passageSentToGemma = result.facts.join("\n\n");

  return [
    ...traceItems,
    {
      id: "generate",
      title: `${result.trace.length + 1}. Generate answer`,
      content: (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
            Section text handed to Gemma
          </p>
          <Expandable
            text={passageSentToGemma || "(no content — no matching document/section found)"}
            lines={4}
          />
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">Answer</p>
          <p className="whitespace-pre-wrap font-medium text-foreground">{result.answer}</p>
        </div>
      ),
    },
  ];
}

function TradeoffsTable() {
  const rows: [string, React.ReactNode, React.ReactNode][] = [
    [
      "Setup cost",
      "Embed + index the whole corpus up front",
      "None — just groups existing section titles, no LLM call",
    ],
    [
      "Per-query cost",
      "One embedding + one similarity search",
      "Two LLM round-trips (pick document, pick section) + one lookup",
    ],
    ["Freshness", "Stale until re-indexed", "Always sees the latest documents"],
    [
      "Failure mode",
      "Retrieves the wrong (but similar-sounding) chunk",
      "Reads a whole section verbatim, but can miss if the answer spans multiple documents",
    ],
    [
      "Explainability",
      "A similarity score",
      <>
        A readable <Abbr term="ToC" expansion="Table of Contents" /> decision trace, plus the exact
        section text used
      </>,
    ],
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface p-4">
      <p className="mb-3 text-xs font-semibold tracking-wide text-foreground/50 uppercase">Tradeoffs</p>
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead>
          <tr className="text-foreground/50">
            <th className="pb-2 pr-3 font-medium"></th>
            <th className="pb-2 pr-3 font-medium" style={{ color: "var(--vector)" }}>
              Classic RAG
            </th>
            <th className="pb-2 font-medium" style={{ color: "var(--pageindex)" }}>
              Vectorless RAG
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label} className="border-t border-surface-border">
              <td className="py-2 pr-3 font-medium text-foreground/70">{label}</td>
              <td className="py-2 pr-3 text-foreground/60">{a}</td>
              <td className="py-2 text-foreground/60">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
