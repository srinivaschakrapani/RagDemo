"use client";

import { useEffect, useState } from "react";

export type ThemeColor = "vector" | "pageindex" | "chunking";

export const EXAMPLE_QUESTIONS = [
  "What is metformin used to treat?",
  "What is the recommended dosage of ibuprofen?",
  "What are the warnings for taking clonazepam?",
];

export const VECTOR_LOADING_MESSAGES = [
  "Embedding your question…",
  "Searching the vector DB…",
  "Ranking by cosine similarity…",
  "Waking the Gemma A10G (cold starts take ~60s)…",
  "Reading the top-k chunks…",
];

export const PAGEINDEX_LOADING_MESSAGES = [
  "Reading the table of contents…",
  "Picking the right document…",
  "Picking the right section(s)…",
  "Waking the Gemma A10G (cold starts take ~60s)…",
  "Reading the full section text…",
];

/** Cycles through `messages` at random start, one at a time, while `active` is true. */
export function useRotatingMessage(messages: string[], active: boolean, intervalMs = 1700): string {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * messages.length));

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return messages[index];
}

export type AccordionItem = {
  id: string;
  title: React.ReactNode;
  badge?: string;
  content: React.ReactNode;
};

export function Accordion({ items, color }: { items: AccordionItem[]; color: ThemeColor }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <div key={item.id} className="overflow-hidden rounded-lg border border-surface-border">
            <button
              onClick={() => toggle(item.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-background/40"
            >
              <span className="flex flex-wrap items-center gap-1.5">
                {item.title}
                {item.badge && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ background: `var(--${color})` }}
                  >
                    {item.badge}
                  </span>
                )}
              </span>
              <span className={`shrink-0 text-foreground/40 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {isOpen && (
              <div className="animate-fade-in-up border-t border-surface-border bg-background/30 px-3 py-2.5 text-xs leading-5 text-foreground/70">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const TRACE_ACTION_LABELS: Record<string, string> = {
  select_document: "select_document",
  select_sections: "select_sections",
  fetch_content: "fetch_content",
  submit_answer: "submit_answer",
};

export function ObservationDetail({ observation }: { observation: unknown }) {
  if (observation == null) return null;
  if (typeof observation === "string") {
    return <p>{observation}</p>;
  }
  if (Array.isArray(observation)) {
    if (observation.length === 0) {
      return <p className="italic text-foreground/40">none</p>;
    }
    if (typeof observation[0] === "string") {
      return (
        <ul className="flex flex-col gap-1">
          {observation.map((fact, i) => (
            <li key={i}>{String(fact)}</li>
          ))}
        </ul>
      );
    }
    return null;
  }
  const obs = observation as Record<string, unknown>;
  if (Array.isArray(obs.matched)) {
    const matched = obs.matched as unknown[];
    if (matched.length === 0) {
      return <p className="italic text-foreground/40">no matches</p>;
    }
    if (typeof matched[0] === "string") {
      return (
        <ul className="flex flex-wrap gap-1.5">
          {(matched as string[]).map((label) => (
            <li key={label} className="rounded-full border border-surface-border px-2 py-0.5 text-[11px]">
              {label}
            </li>
          ))}
        </ul>
      );
    }
    const entities = matched as { id: string; label: string; kind: string }[];
    return (
      <ul className="flex flex-wrap gap-1.5">
        {entities.map((m) => (
          <li key={m.id} className="rounded-full border border-surface-border px-2 py-0.5 text-[11px]">
            {m.label} <span className="text-foreground/40">({m.kind})</span>
          </li>
        ))}
      </ul>
    );
  }
  if ("matched" in obs && (typeof obs.matched === "string" || obs.matched === null)) {
    return obs.matched ? (
      <p className="font-medium">{String(obs.matched)}</p>
    ) : (
      <p className="italic text-foreground/40">no document matched</p>
    );
  }
  if ("ok" in obs) {
    return <p>{obs.ok ? "done." : `no answer — ${String(obs.reason ?? "unknown")}`}</p>;
  }
  return null;
}

export type Step = { id: string; label: string; content: React.ReactNode };

export function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-surface-border bg-background/40 p-3 font-mono text-[11px] leading-5 text-foreground/80">
      {children}
    </pre>
  );
}

/** Freely-navigable step breakdown: pill rail + dot nav + prev/next, all jumpable. */
export function StepThrough({
  steps,
  color,
  resetKey,
}: {
  steps: Step[];
  color: ThemeColor;
  resetKey: unknown;
}) {
  const [current, setCurrent] = useState(0);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setCurrent(0);
  }

  const step = steps[current];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrent(i)}
            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              borderColor: i === current ? `var(--${color})` : "var(--surface-border)",
              background: i === current ? `var(--${color})` : "transparent",
              color: i === current ? "white" : "var(--foreground)",
              opacity: i === current ? 1 : 0.65,
            }}
          >
            <span className="font-mono">{i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>

      <div
        key={step.id}
        className="animate-fade-in-up min-h-[220px] rounded-2xl border border-surface-border bg-surface p-4 text-xs leading-5 text-foreground/70"
      >
        {step.content}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="shrink-0 rounded-full border border-surface-border px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:border-foreground/40 disabled:pointer-events-none disabled:opacity-30"
        >
          ← Back
        </button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to step ${i + 1}: ${steps[i].label}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === current ? 16 : 6,
                background: i === current ? `var(--${color})` : "var(--surface-border)",
              }}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrent((c) => Math.min(steps.length - 1, c + 1))}
          disabled={current === steps.length - 1}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-30"
          style={{ background: `var(--${color})` }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export function AskBox({
  question,
  setQuestion,
  onAsk,
  loading,
  examples,
  onExample,
  color,
}: {
  question: string;
  setQuestion: (q: string) => void;
  onAsk: () => void;
  loading: boolean;
  examples: string[];
  onExample: (ex: string) => void;
  color: ThemeColor | "accent";
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about the corpus…"
          onKeyDown={(e) => e.key === "Enter" && onAsk()}
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
        />
        <button
          onClick={onAsk}
          disabled={loading || !question.trim()}
          className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: `var(--${color})` }}
        >
          Ask
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-surface-border pt-2">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => onExample(ex)}
            disabled={loading}
            className="rounded-full border border-surface-border px-2.5 py-1 text-[11px] text-foreground/60 transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-40"
          >
            {ex.length > 60 ? ex.slice(0, 57) + "…" : ex}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Spinner({ color }: { color: ThemeColor }) {
  return (
    <span className="flex gap-1">
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]"
        style={{ background: `var(--${color})` }}
      />
      <span
        className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]"
        style={{ background: `var(--${color})` }}
      />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: `var(--${color})` }} />
    </span>
  );
}
