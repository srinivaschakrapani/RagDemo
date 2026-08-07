"use client";

import { useState } from "react";
import Link from "next/link";
import { Abbr } from "./shared";
import type { ThemeColor } from "./shared";

type ApproachKey = "vector" | "vectorless";

const APPROACHES: {
  key: ApproachKey;
  color: ThemeColor;
  title: string;
  tagline: string;
  points: React.ReactNode[];
  extra?: React.ReactNode;
  href: string;
  cta: string;
}[] = [
  {
    key: "vector",
    color: "vector",
    title: "Vector RAG",
    tagline: "Embed everything ahead of time — but embeddings can mislead",
    points: [
      "Every passage is embedded into a vector once, up front, and held in FAISS entirely in memory — no separate vector-db service.",
      "At query time, the question is embedded too, and FAISS returns the nearest passages by cosine similarity. Fast per-query, but the index goes stale the moment documents change.",
      "Grounding isn't the same as grounding correctly, though: it searches by how close two pieces of text sit in embedding space, and closeness there doesn't always mean closeness in meaning. The embedding model never reads the label — it only ever sees a vector, computed once, divorced from the question being asked.",
    ],
    extra: <VectorPitfall />,
    href: "/vector",
    cta: "Try Vector RAG →",
  },
  {
    key: "vectorless",
    color: "pageindex",
    title: "Vectorless RAG",
    tagline: "A table of contents instead of a vector index",
    points: [
      "No embeddings. An offline pass groups every drug label's own section titles into a table of contents — nothing else to build ahead of time.",
      <>
        At query time, an LLM reasons over that <Abbr term="ToC" expansion="Table of Contents" /> to
        pick the right document, then the right section(s), before reading the full text.
      </>,
      "Always sees the latest documents and reads a whole section verbatim, but can miss if the answer spans multiple documents.",
      "This demo implements the idea with PageIndex, a reasoning-based, vector-free retrieval method — read the drug's real name, go to that document specifically, then the section that would hold the answer. No vector space to get confused in.",
    ],
    href: "/pageindex",
    cta: "Try Vectorless RAG →",
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
                background: isActive ? `var(--${a.color})` : "transparent",
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
          <h2 className="text-lg font-bold" style={{ color: `var(--${approach.color})` }}>
            {approach.title}
          </h2>
          <p className="text-xs text-foreground/50">{approach.tagline}</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm leading-5 text-foreground/70">
          {approach.points.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span
                className="mt-1 h-1 w-1 shrink-0 rounded-full"
                style={{ background: `var(--${approach.color})` }}
              />
              {p}
            </li>
          ))}
        </ul>

        {approach.extra}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Link
            href={approach.href}
            className="self-start text-sm font-medium underline decoration-dotted underline-offset-2"
            style={{ color: `var(--${approach.color})` }}
          >
            {approach.cta}
          </Link>
          {active === "vector" && (
            <button
              onClick={() => setActive("vectorless")}
              className="self-start rounded-full px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--pageindex)" }}
            >
              What if retrieval skipped vectors entirely? →
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-foreground/40">
        {active === "vector" ? "Click Vectorless RAG above to compare →" : "← Click Vector RAG above to compare"}
      </p>
    </div>
  );
}

function VectorPitfall() {
  return (
    <div>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-surface-border bg-background/40 p-3 sm:flex-row sm:justify-center">
        <DrugChip name="hydrALAZINE" note="a blood-pressure vasodilator" />
        <span
          className="whitespace-nowrap text-center text-[11px] font-medium"
          style={{ color: "var(--vector)" }}
        >
          share &ldquo;hydr…azine&rdquo;-shaped subword tokens →<br className="hidden sm:block" />
          sit closer in vector space than they should
        </span>
        <DrugChip name="hydrOXYzine" note="an antihistamine for anxiety" />
      </div>
      <p className="mt-2 text-center text-[11px] italic text-foreground/40">
        A real pair from the{" "}
        <a
          href="https://www.ismp.org/system/files/resources/2023-10/ISMP_ConfusedDrugNames_2023.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-foreground/60"
        >
          ISMP List of Confused Drug Names
        </a>{" "}
        &mdash; the odd mid-word capitalization above is &ldquo;tall-man lettering,&rdquo; the
        FDA/ISMP&apos;s own fix for this exact mix-up. Ask about one drug and a similarity search
        can still hand back a passage from the other.
      </p>
    </div>
  );
}

function DrugChip({ name, note }: { name: string; note: string }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-center" style={{ borderColor: "var(--vector)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--vector)" }}>
        {name}
      </p>
      <p className="text-[10px] text-foreground/50">{note}</p>
    </div>
  );
}
