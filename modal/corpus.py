"""Shared corpus loader -- used by both VectorRAG and PageIndexRAG (app.py)."""

from __future__ import annotations

import json


def load_corpus(path: str) -> list[dict]:
    passages = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            passages.append(json.loads(line))
    return passages
