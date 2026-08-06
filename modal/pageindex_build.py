"""Offline batch job: read ragdemo_corpus.jsonl (already on the ragdemo-index
Volume, see spl_corpus_build.py) and build the table-of-contents structure that
the PageIndex RAG tab reasons over at query time (see pageindex_tools.py).

This needs no LLM call at all -- the ToC is just the section titles the
corpus already carries, regrouped by drug and split into a
two-level tree. Sections like "Adverse Reactions - 6.1 Clinical Studies
Experience" split on " - " into a parent title ("Adverse Reactions") and a
numbered child ("6.1 Clinical Studies Experience"); sections with no "-" (e.g.
"Contraindications") are parent-only, single-passage entries. Each parent
title's passage_ids cover every passage filed under it, children included, so
fetch_content (query time) can hand over the whole section's text regardless
of how finely DailyMed split it.

Run once via `modal run modal/pageindex_build.py`. Re-run any time the corpus
changes.
"""

from __future__ import annotations

import json

import modal

import config

app = modal.App(f"{config.PROJECT}-pageindex-build")

image = modal.Image.debian_slim(python_version="3.12").add_local_python_source("config", "corpus")

index_volume = modal.Volume.from_name(config.INDEX_VOLUME_NAME, create_if_missing=False)
VOLUMES = {config.DATA_ROOT: index_volume}

SECTION_SEP = " – "  # en dash, matches the separator already used in corpus section names


def _split_section(section: str) -> tuple[str, str | None]:
    if SECTION_SEP in section:
        parent, child = section.split(SECTION_SEP, 1)
        return parent.strip(), child.strip()
    return section.strip(), None


@app.function(image=image, volumes=VOLUMES, timeout=60)
def build_pageindex_job() -> dict:
    from corpus import load_corpus

    passages = load_corpus(config.CORPUS_PATH)

    by_drug: dict[str, list[dict]] = {}
    for p in passages:
        by_drug.setdefault(p["drug_name"], []).append(p)

    documents = []
    for drug_name, drug_passages in by_drug.items():
        sections: dict[str, dict] = {}
        for p in drug_passages:
            parent, child = _split_section(p["section"])
            entry = sections.setdefault(parent, {"title": parent, "children": [], "passage_ids": []})
            entry["passage_ids"].append(p["id"])
            if child is not None and child not in entry["children"]:
                entry["children"].append(child)

        documents.append({
            "drug_name": drug_name,
            "category": drug_passages[0]["category"],
            "sections": list(sections.values()),
        })

    out = {"documents": documents}
    with open(config.PAGEINDEX_PATH, "w", encoding="utf-8") as fh:
        json.dump(out, fh)
    index_volume.commit()

    report = {
        "drugs": len(documents),
        "sections": sum(len(d["sections"]) for d in documents),
    }
    print(f"PAGEINDEX BUILD REPORT: {report}")
    return report


@app.local_entrypoint()
def build_pageindex():
    print(build_pageindex_job.remote())
