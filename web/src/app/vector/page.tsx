"use client";

import { useState } from "react";
import EmbeddingScatter from "./embedding-scatter";
import {
  AskBox,
  CodeBlock,
  EXAMPLE_QUESTIONS,
  Expandable,
  Spinner,
  StepThrough,
  VECTOR_LOADING_MESSAGES,
  useRotatingMessage,
} from "../shared";
import type { Step } from "../shared";
import { parseApiResponse } from "@/lib/api";
import type { VectorRAGResponse } from "@/lib/types";

// Fixed backend constants (modal/config.py) — not per-request data, safe to show as-is.
const GEMMA_MAX_NEW_TOKENS = 200;
const PASSAGE_CHAR_CAP = 4_000;

export default function VectorPage() {
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VectorRAGResponse | null>(null);
  const [askCount, setAskCount] = useState(0);
  const loadingMessage = useRotatingMessage(VECTOR_LOADING_MESSAGES, loading);

  async function onAsk(q?: string) {
    const asked = (q ?? question).trim();
    if (!asked || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/rag-vector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: asked, top_k: 5 }),
      });
      const data = await parseApiResponse<VectorRAGResponse>(res);
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
        <h1 className="text-2xl font-bold" style={{ color: "var(--vector)" }}>
          Classic RAG
        </h1>
        <p className="mt-1 text-sm leading-6 text-foreground/70">
          Your question is embedded and compared against every pre-embedded passage from a curated
          set of DailyMed drug labels. Ask something, then step through exactly what happened
          between your question and the answer below.
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
        color="vector"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-foreground/60">
          <Spinner color="vector" />
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
          <StepThrough steps={buildVectorSteps(result, askedQuestion)} color="vector" resetKey={askCount} />
        </div>
      )}
    </div>
  );
}

function buildVectorSteps(result: VectorRAGResponse, askedQuestion: string): Step[] {
  const passage = result.chunks.map((c) => c.text).join("\n\n");
  const truncated = passage.length > PASSAGE_CHAR_CAP;
  const sentPassage = truncated ? passage.slice(0, PASSAGE_CHAR_CAP) : passage;
  const passagePreview = sentPassage.length > 220 ? sentPassage.slice(0, 220) + "…" : sentPassage;
  const corpusSize = result.corpus_points_2d.length;

  return [
    {
      id: "ask",
      label: "Ask",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            Nothing is embedded or searched yet — the question goes straight to the Modal endpoint
            as-is, along with how many chunks to retrieve.
          </p>
          <CodeBlock>
            {JSON.stringify({ question: askedQuestion, top_k: result.chunks.length }, null, 2)}
          </CodeBlock>
        </div>
      ),
    },
    {
      id: "embed",
      label: "Embed",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            The question is converted into a 384-dim vector by{" "}
            <code>sentence-transformers/all-MiniLM-L6-v2</code> — the same model, with the same
            cosine normalization, used to embed every one of the {corpusSize} corpus passages ahead
            of time. Same model and normalization is what lets the two be compared directly.
          </p>
          <p>
            Projected to 2D for the scatter plot in the next step, this question lands at{" "}
            <span className="font-mono font-semibold" style={{ color: "var(--vector)" }}>
              ({result.query_point_2d.x.toFixed(3)}, {result.query_point_2d.y.toFixed(3)})
            </span>
            .
          </p>
        </div>
      ),
    },
    {
      id: "retrieve",
      label: "Retrieve",
      content: (
        <div className="flex flex-col gap-4">
          <p>
            FAISS (an in-memory <code>IndexFlatIP</code>, rebuilt fresh each time this backend
            container starts — no separate vector-db service) ranks all {corpusSize} passages by
            cosine similarity to that vector and returns the top-{result.chunks.length}. Nothing has
            read the actual words yet — this ranking is pure geometry.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                Corpus embedding space
              </p>
              <EmbeddingScatter
                corpusPoints={result.corpus_points_2d}
                queryPoint={result.query_point_2d}
                highlightedIds={new Set(result.chunks.map((c) => c.id))}
              />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                Top-{result.chunks.length} by cosine similarity
              </p>
              <ul className="flex flex-col gap-2">
                {result.chunks.map((c) => (
                  <li key={c.id} className="rounded-lg border border-surface-border bg-background/30 p-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-foreground/50">
                      <span>
                        #{c.id} · {c.drug_name} · {c.section}
                      </span>
                      <span className="font-mono font-semibold" style={{ color: "var(--vector)" }}>
                        {c.score.toFixed(3)}
                      </span>
                    </div>
                    <Expandable text={c.text} lines={3} className="text-xs leading-4" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "assemble",
      label: "Assemble",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            The {result.chunks.length} retrieved passages are joined into one block, in ranked
            order, separated by a blank line — the only context the model will ever see.
          </p>
          <CodeBlock>{sentPassage}</CodeBlock>
          <p className="text-[11px] text-foreground/50">
            {passage.length.toLocaleString()} characters total
            {truncated
              ? ` — trimmed to the ${PASSAGE_CHAR_CAP.toLocaleString()}-character cap before being sent onward.`
              : ` — under the ${PASSAGE_CHAR_CAP.toLocaleString()}-character cap, nothing trimmed.`}
          </p>
        </div>
      ),
    },
    {
      id: "generate",
      label: "Generate",
      content: (
        <div className="flex flex-col gap-3">
          <p>
            The assembled passage and the original question are sent to the self-hosted Gemma 4 2B
            model the Vectorless lane also calls — identical generator, so any difference in the
            final answer comes from retrieval alone.
          </p>
          <CodeBlock>
            {JSON.stringify(
              {
                passage: passagePreview,
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
            {(result.timing_ms / 1000).toFixed(1)}s end-to-end · ~{result.tokens_used} tokens ·{" "}
            {result.llm_calls} LLM call{result.llm_calls === 1 ? "" : "s"}
          </p>
          <p className="text-[11px] leading-5 text-foreground/50">
            Gemma 4 2B was called exactly once, here, to generate this answer. Embedding and FAISS
            retrieval above are pure math — no LLM involved until this final step.
          </p>
        </div>
      ),
    },
  ];
}
