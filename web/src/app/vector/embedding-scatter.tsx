"use client";

import { useMemo, useState } from "react";
import type { CorpusPoint, Point2D } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  prescription: "#7c3aed",
  otc: "#ec4899",
  animal: "#0ea5e9",
  homeopathic: "#f59e0b",
  other: "#64748b",
};

export default function EmbeddingScatter({
  corpusPoints,
  queryPoint,
  highlightedIds,
}: {
  corpusPoints: CorpusPoint[];
  queryPoint: Point2D;
  highlightedIds: Set<number>;
}) {
  const [hovered, setHovered] = useState<CorpusPoint | null>(null);

  const { toSvg } = useMemo(() => {
    const xs = corpusPoints.map((p) => p.x).concat(queryPoint.x);
    const ys = corpusPoints.map((p) => p.y).concat(queryPoint.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 0.12 * Math.max(maxX - minX, maxY - minY, 0.01);
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const size = 320;
    return {
      toSvg: (x: number, y: number) => ({
        x: ((x - minX + pad) / w) * size,
        // flip y so it reads top-down naturally
        y: size - ((y - minY + pad) / h) * size,
      }),
    };
  }, [corpusPoints, queryPoint]);

  const qp = toSvg(queryPoint.x, queryPoint.y);

  return (
    <div className="relative">
      <svg viewBox="0 0 320 320" className="w-full rounded-xl border border-surface-border bg-background/40">
        {corpusPoints.map((p) => {
          const { x, y } = toSvg(p.x, p.y);
          const isHit = highlightedIds.has(p.id);
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={isHit ? 4.5 : 2.5}
              fill={CATEGORY_COLORS[p.category] ?? "#999"}
              opacity={isHit ? 1 : 0.35}
              stroke={isHit ? "var(--foreground)" : "none"}
              strokeWidth={isHit ? 1 : 0}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered((h) => (h?.id === p.id ? null : h))}
            />
          );
        })}
        <path
          d={`M ${qp.x - 6} ${qp.y} L ${qp.x} ${qp.y - 6} L ${qp.x + 6} ${qp.y} L ${qp.x} ${qp.y + 6} Z`}
          fill="var(--accent-2)"
          stroke="white"
          strokeWidth={1}
        />
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-foreground/60">
        <Legend color="#7c3aed" label="prescription" />
        <Legend color="#ec4899" label="otc" />
        <Legend color="#0ea5e9" label="animal" />
        <Legend color="#f59e0b" label="homeopathic" />
        <Legend color="#64748b" label="other" />
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rotate-45 bg-accent-2" /> your question
        </span>
        <span>· bold = retrieved</span>
      </div>

      {hovered && (
        <div className="mt-2 rounded-lg border border-surface-border bg-surface p-2 text-[11px] text-foreground/70">
          #{hovered.id} · {hovered.drug_name} · {hovered.section} ({hovered.category})
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
