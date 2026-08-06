export type Chunk = {
  id: number;
  drug_name: string;
  category: string;
  section: string;
  text: string;
  score: number;
};

export type Point2D = { x: number; y: number };

export type CorpusPoint = {
  id: number;
  drug_name: string;
  category: string;
  section: string;
  x: number;
  y: number;
};

export type VectorRAGResponse = {
  chunks: Chunk[];
  query_point_2d: Point2D;
  corpus_points_2d: CorpusPoint[];
  answer: string;
  timing_ms: number;
  tokens_used: number;
  llm_calls: number;
};

export type PageIndexTraceStep = {
  action: "select_document" | "select_sections" | "fetch_content" | "submit_answer";
  args: Record<string, unknown>;
  observation: unknown;
};

export type ToCSection = { title: string; children: string[]; passage_ids: number[] };

export type PageIndexRAGResponse = {
  trace: PageIndexTraceStep[];
  toc: ToCSection[] | null;
  matched_document: string | null;
  matched_sections: string[];
  facts: string[];
  answer: string;
  timing_ms: number;
  tokens_used: number;
  llm_calls: number;
};

export type ApiError = { error?: string; detail?: string };
