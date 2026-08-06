"use client";

import { useState } from "react";

const QUIZ: {
  question: string;
  options: string[];
  correct: number;
  explain: string;
}[] = [
  {
    question: "According to OpenAI's own 2025 research, why do LLMs hallucinate?",
    options: [
      "The model is too small to know the answer",
      "Training and grading reward a confident guess over admitting uncertainty",
      "The context window is too short",
      "The training data was corrupted",
    ],
    correct: 1,
    explain:
      "Like a multiple-choice test-taker, a model that guesses scores better on average than one that admits \"I don't know\" — so guessing gets reinforced.",
  },
  {
    question: "In this demo, why can a question about hydrALAZINE return a passage about hydrOXYzine?",
    options: [
      "FAISS returns results alphabetically",
      "The two labels are stored in the same file",
      "Their embeddings can sit close together from shared subword tokens, despite being unrelated drugs",
      "The re-ranker swaps similar-looking names on purpose",
    ],
    correct: 2,
    explain:
      "The embedding model never reads the label — it only sees a vector shaped partly by the drug name's own spelling, and hydrALAZINE / hydrOXYzine look alike to it.",
  },
  {
    question: "What does PageIndex RAG use instead of a vector index?",
    options: [
      "A second, larger embedding model",
      "A table of contents built from each document's own section titles",
      "A SQL full-text search index",
      "A cache of previous answers",
    ],
    correct: 1,
    explain:
      "No embeddings at all — an LLM reasons directly over each label's real section titles to pick the document, then the section.",
  },
  {
    question: "Per Kandpal et al. (ICML 2023), what does it take for a bare LLM to reliably know a fact?",
    options: [
      "A bigger context window",
      "The fact has to repeat often across its training data — rarity beats model size",
      "Fine-tuning on that one fact once",
      "Nothing — modern LLMs know all public facts",
    ],
    correct: 1,
    explain:
      "Scaling the model up doesn't fix thin coverage — a niche 51-label drug corpus has essentially no presence in any general-purpose LLM's training data.",
  },
];

export default function QuizSection() {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
        Quick poll
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/70">
        Four questions pulled straight from the sections above — read them out (or paste into a
        Teams poll) and click to reveal the answer here once votes are in.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {QUIZ.map((q, i) => {
          const isRevealed = revealed.has(i);
          return (
            <div key={i} className="rounded-lg border border-surface-border bg-background/40 p-3.5">
              <p className="text-xs font-semibold text-foreground/40">Q{i + 1}</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{q.question}</p>

              <ul className="mt-2.5 flex flex-col gap-1.5">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correct;
                  const highlight = isRevealed && isCorrect;
                  return (
                    <li
                      key={oi}
                      className="rounded-md border px-2.5 py-1.5 text-[12.5px] leading-4 transition-colors"
                      style={{
                        borderColor: highlight ? "var(--accent)" : "var(--surface-border)",
                        color: highlight ? "var(--accent)" : "var(--foreground)",
                        opacity: highlight ? 1 : 0.75,
                        fontWeight: highlight ? 600 : 400,
                      }}
                    >
                      <span className="mr-1.5 font-mono text-[11px] text-foreground/40">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      {highlight && <span className="mr-1">✓</span>}
                      {opt}
                    </li>
                  );
                })}
              </ul>

              <button
                onClick={() => toggle(i)}
                className="mt-2.5 text-[11px] font-medium underline decoration-dotted underline-offset-2"
                style={{ color: "var(--accent)" }}
              >
                {isRevealed ? "Hide answer ▴" : "Reveal answer ▾"}
              </button>

              {isRevealed && (
                <p className="animate-fade-in-up mt-1.5 text-[11.5px] leading-4 text-foreground/60">
                  {q.explain}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
