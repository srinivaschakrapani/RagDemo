"""Local one-time script (not deployed to Modal): build the worked examples the
Chunking tab steps through. Not run automatically -- it's a teaching-content
generator, run once with `pip install docling` in a throwaway venv, output
committed straight into the frontend as static JSON.

For each of a handful of representative drug labels (already parsed into
ragdemo_corpus.jsonl by spl_corpus_build.py), this:
  1. Reassembles the label's sections into Markdown (so docling has a real,
     supported input format -- SPL's own HL7 XML isn't one docling parses).
  2. Runs docling's real HybridChunker over that Markdown to get
     structure-aware chunks (each one respects a section/subsection boundary).
  3. Also computes naive fixed-size word-window chunks over the *same* raw
     text, ignoring structure entirely, for a side-by-side contrast.

Run: `python chunking_examples_build.py` (from a venv with docling installed).
"""

from __future__ import annotations

import json
import re
import tempfile
from pathlib import Path

from docling.chunking import HybridChunker
from docling.document_converter import DocumentConverter

CORPUS_PATH = Path(__file__).parent / "ragdemo_corpus.jsonl"
OUT_PATH = Path(__file__).parent.parent / "web" / "public" / "chunking-examples.json"

# Chosen for narrative variety: a plain label, one with nested sub-indications
# (Clonazepam's Seizure Disorders / Panic Disorder), a long multi-section
# biologic monograph, and an OTC Drug-Facts-style label.
EXAMPLE_DRUGS = [
    "Finasteride",
    "Clonazepam",
    "Hydroxyzine hydrochloride",
    "Metformin hydrochloride",
    "Ibuprofen",
    "KRESLADI",
]

NAIVE_WINDOW_WORDS = 60


def load_corpus() -> list[dict]:
    records = []
    with CORPUS_PATH.open(encoding="utf-8") as fh:
        for line in fh:
            records.append(json.loads(line))
    return records


def to_markdown(drug_name: str, sections: list[dict]) -> str:
    parts = [f"# {drug_name}\n"]
    for s in sections:
        parts.append(f"## {s['section']}\n\n{s['text']}\n")
    return "\n".join(parts)


def naive_windows(text: str, n: int) -> list[dict]:
    words = re.sub(r"\s+", " ", text).strip().split(" ")
    out = []
    for i in range(0, len(words), n):
        chunk_words = words[i : i + n]
        if not chunk_words:
            continue
        out.append({"text": " ".join(chunk_words), "word_count": len(chunk_words)})
    return out


def build_example(drug_name: str, sections: list[dict]) -> dict:
    raw_text = " ".join(s["text"] for s in sections)
    markdown = to_markdown(drug_name, sections)

    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as fh:
        fh.write(markdown)
        md_path = fh.name

    converter = DocumentConverter()
    doc = converter.convert(md_path).document
    chunker = HybridChunker()
    docling_chunks = []
    for chunk in chunker.chunk(doc):
        headings = getattr(chunk.meta, "headings", None) or []
        docling_chunks.append({
            "text": chunk.text,
            "word_count": len(chunk.text.split()),
            "headings": headings,
        })

    return {
        "drug_name": drug_name,
        "sections": [{"section": s["section"], "text": s["text"]} for s in sections],
        "raw_word_count": len(raw_text.split()),
        "markdown": markdown,
        "naive_chunks": naive_windows(raw_text, NAIVE_WINDOW_WORDS),
        "docling_chunks": docling_chunks,
    }


def main() -> None:
    passages = load_corpus()
    by_drug: dict[str, list[dict]] = {}
    for p in passages:
        by_drug.setdefault(p["drug_name"], []).append(p)

    examples = []
    for drug_name in EXAMPLE_DRUGS:
        sections = by_drug.get(drug_name)
        if not sections:
            print(f"! {drug_name} not found in corpus, skipping")
            continue
        ex = build_example(drug_name, sections)
        print(
            f"{drug_name}: {ex['raw_word_count']} words -> "
            f"{len(ex['naive_chunks'])} naive chunks, {len(ex['docling_chunks'])} docling chunks"
        )
        examples.append(ex)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as fh:
        json.dump(examples, fh, indent=2)
    print(f"\nWrote {len(examples)} examples -> {OUT_PATH}")


if __name__ == "__main__":
    main()
