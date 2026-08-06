"use client";

import type { ToCSection } from "@/lib/types";

export default function TocView({
  drugName,
  sections,
  matchedTitles,
}: {
  drugName: string;
  sections: ToCSection[];
  matchedTitles: string[];
}) {
  const matched = new Set(matchedTitles);

  return (
    <div className="rounded-xl border border-surface-border bg-background/40 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
        {drugName} — table of contents
      </p>
      <ul className="flex flex-col gap-1">
        {sections.map((s) => {
          const isMatched = matched.has(s.title);
          return (
            <li key={s.title}>
              <div
                className="rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                style={
                  isMatched
                    ? { background: "var(--pageindex)", color: "white" }
                    : { color: "var(--foreground)", opacity: 0.7 }
                }
              >
                {s.title}
              </div>
              {s.children.length > 0 && (
                <ul className="mt-0.5 ml-4 flex flex-col gap-0.5">
                  {s.children.map((c) => (
                    <li
                      key={c}
                      className="rounded px-2 py-0.5 text-[11px]"
                      style={{ color: "var(--foreground)", opacity: isMatched ? 0.75 : 0.4 }}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
