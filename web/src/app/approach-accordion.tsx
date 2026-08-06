"use client";

import { useState } from "react";
import Link from "next/link";

type ApproachKey = "vector" | "pageindex";

const APPROACHES: {
  key: ApproachKey;
  title: string;
  tagline: string;
  points: string[];
  href: string;
  cta: string;
}[] = [
  {
    key: "vector",
    title: "Classic RAG",
    tagline: "Embed everything, ahead of time",
    points: [
      "Every passage is embedded into a vector once, up front, and held in FAISS entirely in memory — no separate vector-db service.",
      "At query time, the question is embedded too, and FAISS returns the nearest passages by cosine similarity.",
      "Fast per-query (one similarity search), but a wrong-but-similar-sounding chunk can win, and the index goes stale the moment documents change.",
    ],
    href: "/vector",
    cta: "Try classic RAG →",
  },
  {
    key: "pageindex",
    title: "PageIndex RAG",
    tagline: "A table of contents instead of a vector index",
    points: [
      "No embeddings. An offline pass groups every drug label's own section titles into a table of contents — nothing else to build ahead of time.",
      "At query time, an LLM reasons over that ToC to pick the right document, then the right section(s), before reading the full text.",
      "Always sees the latest documents and reads a whole section verbatim, but can miss if the answer spans multiple documents.",
    ],
    href: "/pageindex",
    cta: "Try PageIndex RAG →",
  },
];

export default function ApproachAccordion() {
  const [active, setActive] = useState<ApproachKey>("vector");
  const approach = APPROACHES.find((a) => a.key === active)!;

  return (
    <div>
      <div className="flex gap-1.5 rounded-full border border-surface-border bg-surface p-1">
        {APPROACHES.map((a) => {
          const isActive = a.key === active;
          return (
            <button
              key={a.key}
              onClick={() => setActive(a.key)}
              aria-pressed={isActive}
              className="flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                background: isActive ? `var(--${a.key})` : "transparent",
                color: isActive ? "#fff" : "var(--foreground)",
                opacity: isActive ? 1 : 0.55,
              }}
            >
              {a.title}
            </button>
          );
        })}
      </div>

      <div
        key={approach.key}
        className="animate-fade-in-up mt-3 flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-5 shadow-sm"
      >
        <div>
          <h2 className="text-lg font-bold" style={{ color: `var(--${approach.key})` }}>
            {approach.title}
          </h2>
          <p className="text-xs text-foreground/50">{approach.tagline}</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm leading-5 text-foreground/70">
          {approach.points.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span
                className="mt-1 h-1 w-1 shrink-0 rounded-full"
                style={{ background: `var(--${approach.key})` }}
              />
              {p}
            </li>
          ))}
        </ul>
        <Link
          href={approach.href}
          className="mt-1 self-start text-sm font-medium underline decoration-dotted underline-offset-2"
          style={{ color: `var(--${approach.key})` }}
        >
          {approach.cta}
        </Link>
      </div>

      <p className="mt-2 text-center text-[11px] text-foreground/40">
        {active === "vector" ? "Click PageIndex RAG above to compare →" : "← Click Classic RAG above to compare"}
      </p>
    </div>
  );
}
