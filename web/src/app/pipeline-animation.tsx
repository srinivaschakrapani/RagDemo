"use client";

import { useEffect, useState } from "react";

const STEP_MS = 2400;
const STEP_COUNT = 6;

const VECTOR_NODES = ["Question", "Embed query", "ANN search", "Re-rank", "Top-k chunks", "Gemma 4 2B"];
const VECTOR_CAPTIONS = [
  '"What is metformin used to treat?" arrives as plain text.',
  "The question becomes a 384-dim vector (MiniLM) — same space the corpus was embedded into.",
  "FAISS doesn't compare against all 598 vectors by hand — it's the search structure, walked to find candidates fast.",
  "The candidate set gets re-scored for quality before anything is handed to the generator.",
  "The top 5 re-ranked passages are pulled out — right or wrong, something always comes back.",
  "Question + those 5 passages go into Gemma 4 2B, which writes the final answer.",
];
const VECTOR_WHY = [
  "Every lane starts from the exact same question — so any difference in the final answer traces back to retrieval, not the prompt.",
  "Only things living in the same vector space can be compared — the question has to become a vector before anything else can happen.",
  "Comparing against fewer, better candidates instead of the whole corpus by hand is the entire pitch of vector search at scale.",
  "\"Closest by embedding\" and \"most relevant\" aren't guaranteed to be the same list — this pass catches it when they diverge.",
  "The generator has a fixed, finite context window — it needs a short, ranked shortlist handed to it, not the whole corpus.",
  "Retrieval only ever finds candidate evidence; generation is the step that actually turns it into a written answer.",
];
const VECTOR_ALGOS = [
  null,
  "Bi-encoder embedding — sentence-transformers/all-MiniLM-L6-v2, 384 dimensions.",
  "Exact nearest-neighbor search — FAISS's IndexFlatIP, brute-force cosine similarity over L2-normalized vectors, rebuilt in memory each container start. At ~600 passages exact search is instant; at real-world scale you'd reach for FAISS's own approximate structures (IVF, HNSW, product quantization) instead.",
  "Re-ranking — typically a cross-encoder that scores (query, passage) pairs jointly, much slower but more accurate than the bi-encoder above. Some systems use MMR here instead, to trade a bit of relevance for less redundant chunks. This demo skips this step and uses the FAISS score directly — worth calling out live.",
  "Top-k truncation by score, k=5.",
  "Autoregressive decoding, greedy (no sampling) — same self-hosted Gemma 4 2B either lane uses.",
];

const PAGEINDEX_NODES = ["Question", "Select document", "Select section(s)", "Fetch content", "Assemble passage", "Gemma 4 2B"];
const PAGEINDEX_CAPTIONS = [
  '"What is metformin used to treat?" arrives as plain text.',
  "The self-hosted Gemma 4 2B model reads the question plus every drug's name and category, and picks the single document it's about — a reasoning step, not a similarity search. Falls back to matching drug names directly if that call is unavailable.",
  "Gemma reads just that one document's top-level section titles — not the full text — and picks up to 2 that would contain the answer.",
  "The full passage text under the chosen section(s) — numbered subsections included — is read as-is, no summarizing or chunking.",
  "Every fetched section's text is concatenated in document order into a single passage — this is the only context the generator will see.",
  "Question + that passage go into the same Gemma 4 2B as the other lane.",
];
const PAGEINDEX_WHY = [
  "Same question, same starting line as the other lane — this is meant to be an apples-to-apples comparison.",
  "A drug-label corpus is really 51 separate documents stitched together — pinning down the right one first keeps every other drug's text out of play entirely.",
  "A table of contents is small enough for an LLM to read whole and reason over — no similarity math needed to narrow it down.",
  "Nothing here is a best guess — the section is pulled by its exact title, not scored and hoped for.",
  "The generator needs one coherent passage to read, not a table of contents — this is where selection turns into actual context.",
  "Same generator as the other lane — so any difference in the final answer still traces back to what was retrieved, not how it's phrased.",
];
const PAGEINDEX_ALGOS = [
  null,
  "One Gemma 4 2B call (JSON-constrained prompt) reads the question plus every drug's name and category and emits the single matching document — falls back to word-overlap matching against drug names if the call is unavailable.",
  "A second Gemma 4 2B call reads only that document's section titles (never the full text) and emits up to 2 titles expected to hold the answer — falls back to word-overlap matching against titles.",
  "Direct dictionary lookup, not a search — every passage filed under the chosen section title(s) is retrieved as-is, subsections included.",
  "String concatenation of the fetched section(s) in document order — no re-ranking or budget management, cost is bounded by section count, not corpus size.",
  "Autoregressive decoding, greedy — same self-hosted Gemma 4 2B either lane uses.",
];

const TOC_LINES = [
  "Metformin Hydrochloride — Indications and Usage",
  "Metformin Hydrochloride — Dosage and Administration",
  "Metformin Hydrochloride — Warnings",
  "Hydralazine Hydrochloride — Indications and Usage",
  "Clonazepam — Contraindications",
];

const ADVANCED_CONCEPTS = [
  {
    title: "Hybrid search",
    body: "Run dense (embeddings) and sparse (BM25/keyword) retrieval together, then merge the two ranked lists — often with Reciprocal Rank Fusion (RRF). Catches both semantic matches and exact rare-term matches like names or IDs, which is exactly where our two lanes individually struggle.",
  },
  {
    title: "MMR (Maximal Marginal Relevance)",
    body: "A re-ranking rule that penalizes candidates too similar to ones already picked, so top-k isn't 5 near-duplicate chunks of the same paragraph.",
  },
  {
    title: "Query rewriting / HyDE",
    body: "Before embedding the question, have an LLM rewrite it or hallucinate a plausible answer, then embed *that* — it often sits closer in vector space to real answer passages than the bare question does.",
  },
  {
    title: "Chunking strategy",
    body: "This corpus uses structure-aware chunking — one passage per SPL label section (indications, dosage, warnings, …), built with docling — rather than fixed-size windows, so a chunk boundary never falls mid-thought. See the Chunking tab for a step-by-step walkthrough on real labels.",
  },
  {
    title: "ToC granularity",
    body: "PageIndex's answer quality depends on how descriptive a label's own section titles are — a vaguely named section can get skipped by the selection step even though it holds the answer. This is the PageIndex analogue of vector RAG's chunking-strategy tradeoff.",
  },
];

export default function PipelineAnimation() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEP_COUNT), STEP_MS);
    return () => clearInterval(t);
  }, [playing]);

  function goTo(next: number) {
    setPlaying(false);
    setStep(((next % STEP_COUNT) + STEP_COUNT) % STEP_COUNT);
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
          Watch a question flow through both pipelines
        </p>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-foreground/40">
            {step + 1}/{STEP_COUNT}
          </span>
          <ControlButton onClick={() => goTo(step - 1)} label="◀ Step">
            ◀
          </ControlButton>
          <ControlButton onClick={() => setPlaying((p) => !p)} label={playing ? "Pause" : "Play"}>
            {playing ? "Pause" : "Play"}
          </ControlButton>
          <ControlButton onClick={() => goTo(step + 1)} label="Step ▶">
            ▶
          </ControlButton>
        </div>
      </div>
      <p className="mb-4 -mt-2 text-[11px] text-foreground/40">
        Click ◀ / ▶ to present it one step at a time while you talk — that pauses the auto-play.
      </p>

      <div className="grid gap-8 sm:grid-cols-2">
        <Lane
          color="vector"
          upfront="Done once, ahead of time: all 598 passages chunked, embedded, and held in FAISS entirely in memory."
          nodes={VECTOR_NODES}
          captions={VECTOR_CAPTIONS}
          whys={VECTOR_WHY}
          algos={VECTOR_ALGOS}
          step={step}
          extra={<VectorExtra step={step} />}
        />
        <Lane
          color="pageindex"
          upfront="Done once, ahead of time: labels are grouped by drug, and each one's own section titles become a table of contents — no LLM call needed."
          nodes={PAGEINDEX_NODES}
          captions={PAGEINDEX_CAPTIONS}
          whys={PAGEINDEX_WHY}
          algos={PAGEINDEX_ALGOS}
          step={step}
          extra={<PageIndexExtra step={step} />}
        />
      </div>

      <p className="mt-5 text-[11px] leading-4 text-foreground/50">
        Both run on Modal (CPU for retrieval, the same self-hosted, GPU-served Gemma 4 2B for
        generation). This is a stylized replay for intuition — the live pages further up run the
        real thing (and this demo&apos;s vector lane skips re-ranking, using the ANN score directly).
      </p>

      <div className="mt-4 border-t border-surface-border pt-4">
        <button
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex w-full items-center justify-between text-left text-xs font-semibold tracking-wide text-foreground/60 uppercase hover:text-foreground"
        >
          <span>Advanced RAG concepts these pipelines don&apos;t show yet</span>
          <span className={`inline-block transition-transform ${showAdvanced ? "rotate-180" : ""}`}>▾</span>
        </button>
        {showAdvanced && (
          <ul className="mt-3 flex flex-col gap-3 animate-fade-in-up">
            {ADVANCED_CONCEPTS.map((c) => (
              <li key={c.title} className="text-xs leading-5">
                <span className="font-semibold text-foreground">{c.title}.</span>{" "}
                <span className="text-foreground/60">{c.body}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ControlButton({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="rounded-full border border-surface-border px-2.5 py-1 text-[11px] font-medium text-foreground/60 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Lane({
  color,
  upfront,
  nodes,
  captions,
  whys,
  algos,
  step,
  extra,
}: {
  color: "vector" | "pageindex";
  upfront: string;
  nodes: string[];
  captions: string[];
  whys: string[];
  algos: (string | null)[];
  step: number;
  extra: React.ReactNode;
}) {
  const fraction = step / (nodes.length - 1);

  return (
    <div className="flex flex-col gap-3">
      <p
        className="rounded-lg border px-2.5 py-1.5 text-[10px] leading-4 text-foreground/50"
        style={{ borderColor: "var(--surface-border)", background: "color-mix(in srgb, var(--" + color + ") 6%, transparent)" }}
      >
        {upfront}
      </p>

      <div className="relative pt-2">
        <div className="absolute left-[10px] right-[10px] top-[19px] h-px bg-surface-border" />
        <div
          className="absolute top-[15px] h-2 w-2 -translate-x-1/2 rounded-full shadow transition-all duration-700 ease-out"
          style={{ left: `calc(10px + (100% - 20px) * ${fraction})`, background: `var(--${color})` }}
        />
        <div className="relative flex justify-between">
          {nodes.map((n, i) => {
            const active = i === step;
            const passed = i < step;
            return (
              <div key={n} className="flex flex-col items-center gap-1.5" style={{ width: `${100 / nodes.length}%` }}>
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-300 ${
                    active ? "scale-125 text-white shadow-md" : passed ? "text-white" : "text-foreground/40"
                  }`}
                  style={{
                    background: active || passed ? `var(--${color})` : "var(--surface)",
                    border: active || passed ? "none" : "1px solid var(--surface-border)",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-center text-[10px] leading-tight ${active ? "font-semibold text-foreground" : "text-foreground/50"}`}
                >
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[52px] rounded-lg bg-background/40 p-2.5">
        <p key={step} className="animate-fade-in-up text-[11px] leading-4 text-foreground/70">
          {captions[step]}
        </p>
      </div>

      <div className="min-h-[30px] border-l-2 pl-2.5" style={{ borderColor: `var(--${color})` }}>
        <p key={step} className="animate-fade-in-up text-[10.5px] leading-4 text-foreground/50">
          <span className="font-semibold text-foreground/40">Why: </span>
          {whys[step]}
        </p>
      </div>

      {extra}

      <div className="min-h-[36px] rounded-lg border border-dashed px-2.5 py-2" style={{ borderColor: "var(--surface-border)" }}>
        <p className="mb-0.5 text-[9px] font-semibold tracking-wide text-foreground/40 uppercase">Under the hood</p>
        {algos[step] ? (
          <p key={step} className="animate-fade-in-up text-[10.5px] leading-4 text-foreground/60">
            {algos[step]}
          </p>
        ) : (
          <p className="text-[10.5px] text-foreground/30 italic">no retrieval algorithm involved yet</p>
        )}
      </div>
    </div>
  );
}

function VectorExtra({ step }: { step: number }) {
  const dots = Array.from({ length: 24 });
  const hitIndices = new Set([3, 11, 18]);
  const showQuery = step >= 1;
  const showHits = step >= 2 && step <= 3;
  const showChunks = step === 4;
  const showAnswer = step === 5;

  return (
    <div className="flex min-h-[64px] items-center justify-center rounded-lg border border-surface-border bg-background/30 p-3">
      {showAnswer ? (
        <p className="animate-fade-in-up text-center text-[11px] text-foreground/60">
          → passed to Gemma 4 2B for generation
        </p>
      ) : showChunks ? (
        <div className="flex animate-fade-in-up gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 w-10 rounded border" style={{ borderColor: "var(--vector)" }} />
          ))}
        </div>
      ) : (
        <div className="relative flex flex-wrap items-center justify-center gap-1.5">
          {dots.map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-all duration-500"
              style={{
                background: showHits && hitIndices.has(i) ? "var(--vector)" : "var(--surface-border)",
                transform: showHits && hitIndices.has(i) ? "scale(1.8)" : "scale(1)",
              }}
            />
          ))}
          {showQuery && (
            <span
              className="ml-2 h-2.5 w-2.5 rotate-45 animate-fade-in-up"
              style={{ background: "var(--accent-2)" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PageIndexExtra({ step }: { step: number }) {
  const selectingDoc = step === 1;
  const selectingSection = step === 2;
  const fetching = step === 3;
  const assembling = step === 4;
  const answering = step === 5;

  return (
    <div className="flex min-h-[64px] flex-col justify-center gap-1 rounded-lg border border-surface-border bg-background/30 p-2.5 font-mono">
      {answering ? (
        <p className="animate-fade-in-up text-center text-[11px] text-foreground/60">
          → passed to Gemma 4 2B for generation
        </p>
      ) : assembling ? (
        <div className="flex animate-fade-in-up justify-center gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-8 w-10 rounded border" style={{ borderColor: "var(--pageindex)" }} />
          ))}
        </div>
      ) : (
        TOC_LINES.map((line, i) => {
          const isDocHit = i < 3;
          const isSectionHit = i === 1;
          const highlighted =
            (selectingDoc && isDocHit) || ((selectingSection || fetching) && isSectionHit);
          return (
            <p
              key={i}
              className={`truncate rounded px-1.5 py-0.5 text-[9px] leading-tight transition-all duration-300 ${
                highlighted ? "text-white" : "text-foreground/40"
              }`}
              style={{ background: highlighted ? "var(--pageindex)" : "transparent" }}
            >
              {line}
            </p>
          );
        })
      )}
    </div>
  );
}
