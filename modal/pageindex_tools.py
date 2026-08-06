"""Phase 3 (query time): the table-of-contents reasoning strategy for
"PageIndex" RAG. No embeddings, no graph -- the corpus's own section titles,
grouped into a per-drug ToC tree offline by pageindex_build.py, are read
directly by the LLM to decide which document and which section(s) to open.

Query time is three steps, each recorded as a trace step so the frontend can
render a step-by-step reasoning trace:
  1. select_document  -- the self-hosted Gemma 4 2B (GemmaGenerator in app.py,
     passed in as the ask_select_document callable) reads the question plus
     the list of drug names and picks the one the question is about. Falls
     back to a word-overlap match against drug names if no callable is given
     or the call fails, so a live demo never hard-fails on a cold start or a
     bad generation.
  2. select_sections  -- Gemma reads just that drug's top-level section titles
     and picks up to config.PAGEINDEX_MAX_SECTIONS of them. Same fallback
     shape as step 1, matched against section titles (+ their numbered
     children) instead of drug names.
  3. fetch_content  -- pure lookup, no LLM: the full passage text under the
     chosen section(s), numbered children included, the context handed to
     Gemma for the final answer.
"""

from __future__ import annotations

import json
import re
from typing import Callable

import config

_WORD_RE = re.compile(r"[a-z0-9]+")


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def load_pageindex(path: str) -> dict:
    """Returns {"documents": [{"drug_name", "category", "sections": [{"title",
    "children", "passage_ids"}]}]} -- built offline by pageindex_build.py."""
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _words(text: str) -> set[str]:
    return {w for w in _WORD_RE.findall(text.lower()) if len(w) >= 4}


def select_document(
    question: str,
    documents: list[dict],
    ask_llm: Callable[[str, list[str]], str] | None = None,
) -> tuple[dict | None, bool, str | None]:
    """Returns (matched_document_or_None, used_llm, debug_error)."""
    candidates = [f"{d['drug_name']} ({d['category']})" for d in documents]
    by_name = {d["drug_name"]: d for d in documents}
    debug_error = None

    if ask_llm is not None:
        try:
            picked = ask_llm(question, candidates)
            if picked in by_name:
                return by_name[picked], True, None
            return None, True, (f"LLM picked unrecognized name {picked!r}" if picked else "LLM found no match")
        except Exception as e:
            debug_error = f"{type(e).__name__}: {e}"
    else:
        debug_error = "no ask_llm callable"

    # Fallback: word-overlap against drug names, so a live demo never
    # hard-fails on a cold start or a bad generation.
    q_words = _words(question)
    q_lower = question.lower()
    best, best_score = None, 0.0
    for d in documents:
        name_words = _words(d["drug_name"])
        if not name_words:
            continue
        overlap = len(name_words & q_words)
        if overlap == 0 and d["drug_name"].lower() in q_lower:
            overlap = 1
        if overlap == 0:
            continue
        score = overlap / len(name_words)
        if score > best_score:
            best_score, best = score, d
    return best, False, debug_error


def select_sections(
    question: str,
    document: dict,
    ask_llm: Callable[[str, list[str], int], list[str]] | None = None,
    max_sections: int = config.PAGEINDEX_MAX_SECTIONS,
) -> tuple[list[dict], bool, str | None]:
    """Returns (matched_section_entries, used_llm, debug_error)."""
    sections = document["sections"]
    titles = [s["title"] for s in sections]
    by_title = {s["title"]: s for s in sections}
    debug_error = None

    if ask_llm is not None:
        try:
            picked = ask_llm(question, titles, max_sections)
            matched = [by_title[t] for t in picked if t in by_title]
            if matched:
                return matched, True, None
            return [], True, "LLM picked no recognized sections"
        except Exception as e:
            debug_error = f"{type(e).__name__}: {e}"
    else:
        debug_error = "no ask_llm callable"

    # Fallback: word-overlap against section titles + their numbered children.
    scored = []
    q_words = _words(question)
    for s in sections:
        label = s["title"] + " " + " ".join(s["children"])
        overlap = len(_words(label) & q_words)
        if overlap:
            scored.append((overlap, s))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [s for _, s in scored[:max_sections]], False, debug_error


def fetch_content(sections: list[dict], passages_by_id: dict[int, dict]) -> list[dict]:
    """Flattens the chosen sections' passage_ids into the actual passage dicts,
    in corpus order, deduped (a passage could in principle be listed under
    more than one selected section)."""
    seen: set[int] = set()
    out = []
    for s in sections:
        for pid in s["passage_ids"]:
            if pid in seen:
                continue
            seen.add(pid)
            p = passages_by_id.get(pid)
            if p is not None:
                out.append(p)
    return out


def run_pageindex_query(
    question: str,
    pageindex: dict,
    passages_by_id: dict[int, dict],
    ask_select_document: Callable[[str, list[str]], str] | None = None,
    ask_select_sections: Callable[[str, list[str], int], list[str]] | None = None,
) -> dict:
    trace: list[dict] = []
    tokens = 0
    # Each step is "attempted" for llm_calls purposes as soon as a callable is
    # given, regardless of whether it actually returns a usable answer -- the
    # caller adds one more for the final generate() call.
    llm_calls = (1 if ask_select_document is not None else 0) + (1 if ask_select_sections is not None else 0)

    documents = pageindex["documents"]
    document, used_llm_doc, doc_fallback = select_document(question, documents, ask_select_document)
    if used_llm_doc:
        tokens += _estimate_tokens(question) + 40
    doc_args: dict = {"question": question, "via": "gemma" if used_llm_doc else "word-match fallback"}
    if not used_llm_doc:
        doc_args["fallback_reason"] = doc_fallback
    trace.append({
        "action": "select_document",
        "args": doc_args,
        "observation": {"matched": document["drug_name"] if document else None},
    })

    if document is None:
        trace.append({"action": "submit_answer", "args": {}, "observation": {"ok": False, "reason": "no matching document"}})
        return {
            "trace": trace,
            "facts": [],
            "matched_document": None,
            "matched_sections": [],
            "toc": None,
            "tokens": tokens,
            "llm_calls": llm_calls,
        }

    sections, used_llm_sec, sec_fallback = select_sections(question, document, ask_select_sections)
    if used_llm_sec:
        tokens += _estimate_tokens(question) + 40
    sec_args: dict = {"drug_name": document["drug_name"], "via": "gemma" if used_llm_sec else "word-match fallback"}
    if not used_llm_sec:
        sec_args["fallback_reason"] = sec_fallback
    trace.append({
        "action": "select_sections",
        "args": sec_args,
        "observation": {"matched": [s["title"] for s in sections]},
    })

    if not sections:
        trace.append({"action": "submit_answer", "args": {}, "observation": {"ok": False, "reason": "no matching sections"}})
        return {
            "trace": trace,
            "facts": [],
            "matched_document": document["drug_name"],
            "matched_sections": [],
            "toc": document["sections"],
            "tokens": tokens,
            "llm_calls": llm_calls,
        }

    passages = fetch_content(sections, passages_by_id)
    facts = [p["text"] for p in passages]
    trace.append({
        "action": "fetch_content",
        "args": {"sections": [s["title"] for s in sections]},
        "observation": facts,
    })
    trace.append({"action": "submit_answer", "args": {}, "observation": {"ok": True}})

    return {
        "trace": trace,
        "facts": facts,
        "matched_document": document["drug_name"],
        "matched_sections": [s["title"] for s in sections],
        "toc": document["sections"],
        "tokens": tokens,
        "llm_calls": llm_calls,
    }
