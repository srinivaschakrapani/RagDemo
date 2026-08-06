"""Serving app for the RAG vs. PageIndex-RAG demo, over a DailyMed SPL (drug
label) corpus.

Two retrieval strategies, both calling the same self-hosted GemmaGenerator
(Gemma 4 2B, a Modal class in this app -- no external service) as the final
answer generator, so the comparison isolates retrieval:

  POST /vector      -- embedding + in-memory FAISS (IndexFlatIP / cosine) search.
                        No persisted vector-db file: the index is built fresh
                        from ragdemo_corpus.jsonl each time a container starts.
  POST /pageindex   -- table-of-contents reasoning: GemmaGenerator picks which
                        drug label and which section(s) of it to open, over a
                        per-drug ToC built offline from the same corpus (see
                        pageindex_build.py, pageindex_tools.py). No embeddings,
                        no graph -- just the corpus's own section titles.

Both endpoints require {"token": SERVE_TOKEN} in the body.
"""

from __future__ import annotations

import time

import modal

import config
from corpus import load_corpus
from pageindex_tools import load_pageindex, run_pageindex_query

app = modal.App(config.PROJECT)

index_volume = modal.Volume.from_name(config.INDEX_VOLUME_NAME, create_if_missing=False)
VOLUMES = {config.DATA_ROOT: index_volume}

SECRETS = [
    modal.Secret.from_name(config.SERVE_TOKEN_SECRET_NAME),
]

retrieval_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "sentence-transformers==3.3.1",
        "faiss-cpu==1.9.0",
        "numpy==1.26.4",
        "fastapi[standard]==0.115.4",
    )
    .add_local_python_source("config", "corpus", "pageindex_tools")
)

agent_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi[standard]==0.115.4")
    .add_local_python_source("config", "corpus", "pageindex_tools")
)

# Left unpinned (latest) rather than matching the sibling Gemma project's pinned
# torch==2.5.1 / transformers==4.46.3 -- those predate Gemma 4 support entirely.
gemma_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch",
        "torchvision",  # Gemma4Processor's image pipeline imports this even for text-only use
        "transformers",
        "accelerate",
        "huggingface_hub",
        "pillow",  # Gemma4Processor is a multimodal processor -- requires PIL even for text-only use
    )
    .add_local_python_source("config", "corpus", "pageindex_tools")
)


def _check_token(body: dict) -> None:
    import os

    from fastapi import HTTPException

    if body.get("token") != os.environ["SERVE_TOKEN"]:
        raise HTTPException(status_code=401, detail="unauthorized")


def _estimate_tokens(text: str) -> int:
    """Rough chars/4 estimate for text we don't run through the tokenizer directly
    (the passage/question side) -- good enough to compare the two retrieval
    strategies' relative cost, not for billing. The answer side now uses
    GemmaGenerator's exact output-token count instead of this estimate.

    Relative cost, in GemmaGenerator calls per query: Vector = 1 (generate only),
    PageIndex = 3 (select_document, select_sections, generate) -- see llm_calls
    in each endpoint's response."""
    return max(1, len(text) // 4)


@app.cls(
    image=gemma_image,
    secrets=[modal.Secret.from_name(config.HF_SECRET_NAME)],
    gpu=config.GEMMA_GPU,
    scaledown_window=60 * 5,
    timeout=120,
)
class GemmaGenerator:
    """Self-hosted Gemma 4 2B -- the shared answer generator for both RAG lanes,
    and the document/section selector for the PageIndex lane. All methods run
    against the same warm container, so a cold start is only ever paid once
    regardless of which one triggers it."""

    @modal.enter()
    def load(self):
        import os

        from transformers import AutoModelForImageTextToText, AutoProcessor

        hf_token = os.environ["HF_TOKEN"]
        self.processor = AutoProcessor.from_pretrained(config.GEMMA_MODEL_REPO, token=hf_token)
        self.model = AutoModelForImageTextToText.from_pretrained(
            config.GEMMA_MODEL_REPO, dtype="auto", device_map="auto", token=hf_token,
        )
        self.model.eval()

    def _run(self, system_prompt: str, user_text: str, max_new_tokens: int) -> tuple[str, int]:
        import re

        import torch

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ]
        # enable_thinking=False: without it, Gemma 4 emits a reasoning block before the
        # actual answer, which can eat the whole max_new_tokens budget on short outputs
        # (e.g. select_document) and leave nothing behind. skip_special_tokens=False +
        # processor.parse_response(...) is the model card's own way to correctly strip
        # that thinking block from the decoded text rather than a naive .strip().
        inputs = self.processor.apply_chat_template(
            messages,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
            add_generation_prompt=True,
            enable_thinking=False,
        ).to(self.model.device)

        with torch.no_grad():
            outputs = self.model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)

        new_tokens = outputs[0][inputs["input_ids"].shape[-1]:]
        text = self.processor.decode(new_tokens, skip_special_tokens=True)
        # Gemma 4 appends a literal "<turn|>" (or similar) end marker that isn't
        # registered as a real special token, so skip_special_tokens doesn't touch it --
        # strip it directly as a trailing tag-like sequence.
        text = re.sub(r"<[^<>]{0,40}>\s*$", "", text)
        return text.strip(), int(new_tokens.shape[-1])

    @modal.method()
    def generate(self, passage: str, question: str) -> dict:
        system_prompt = (
            "Answer the question using ONLY the passage below. Be short and factual "
            "-- a single sentence or two. If the passage doesn't contain the answer, "
            "say so."
        )
        user_text = f"Passage:\n{passage[:4_000]}\n\nQuestion: {question}"
        answer, output_tokens = self._run(system_prompt, user_text, config.GEMMA_MAX_NEW_TOKENS)
        return {"answer": answer, "output_tokens": output_tokens}

    @modal.method()
    def select_document(self, question: str, candidates: list[str]) -> str:
        """PageIndex step 1: given the question and a list of "drug_name
        (category)" strings, returns the single most relevant drug_name
        verbatim, or "" if none of them are relevant."""
        import json

        system_prompt = (
            "You are given a question and a list of drug label documents. Return ONLY "
            'JSON: {"drug_name": "..."} naming the single document the question is '
            "about, using the exact drug_name text from the list (drop the category "
            'in parentheses). If none of them are relevant, return {"drug_name": ""}.'
        )
        listing = "\n".join(f"- {c}" for c in candidates)
        user_text = f"Documents:\n{listing}\n\nQuestion: {question}"
        text, _ = self._run(system_prompt, user_text, max_new_tokens=60)
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise RuntimeError(f"no JSON object in {text[:200]!r}")
        return str(json.loads(text[start : end + 1]).get("drug_name") or "").strip()

    @modal.method()
    def select_sections(self, question: str, section_titles: list[str], max_sections: int) -> list[str]:
        """PageIndex step 2: given the question and one document's top-level
        section titles, returns up to max_sections of them verbatim, most
        relevant first."""
        import json

        system_prompt = (
            "You are given a question and a drug label's section titles. Return ONLY "
            f'JSON: {{"sections": ["...", ...]}}, at most {max_sections} titles, using '
            "the exact text from the list, most relevant first -- pick the section(s) "
            "that would contain the answer."
        )
        listing = "\n".join(f"- {t}" for t in section_titles)
        user_text = f"Sections:\n{listing}\n\nQuestion: {question}"
        text, _ = self._run(system_prompt, user_text, max_new_tokens=80)
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise RuntimeError(f"no JSON object in {text[:200]!r}")
        sections = json.loads(text[start : end + 1]).get("sections")
        if not isinstance(sections, list):
            raise RuntimeError(f"no usable sections in {text[:200]!r}")
        return [str(s) for s in sections if str(s).strip()][:max_sections]


@app.cls(image=retrieval_image, volumes=VOLUMES, secrets=SECRETS, scaledown_window=60 * 5, timeout=90)
class VectorRAG:
    @modal.enter()
    def load(self):
        import faiss
        import numpy as np
        from sentence_transformers import SentenceTransformer

        self.passages = load_corpus(config.CORPUS_PATH)
        self.model = SentenceTransformer(config.EMBEDDING_MODEL)

        texts = [p["text"] for p in self.passages]
        embeddings = np.asarray(
            self.model.encode(texts, show_progress_bar=False, normalize_embeddings=True),
            dtype="float32",
        )

        # In-memory FAISS index, rebuilt every container start -- no persisted
        # vector-db file. IndexFlatIP over L2-normalized vectors == exact cosine
        # similarity, which is what "the algorithm FAISS itself provides" means
        # here: FAISS is the search library, MiniLM (already used elsewhere in
        # this project) remains the embedder.
        self.index = faiss.IndexFlatIP(embeddings.shape[1])
        self.index.add(embeddings)

        # 2D PCA projection via SVD (same technique as the old offline build
        # step), computed once per container from the same embeddings -- at
        # ~600 passages this is instant, so no separate build job is needed.
        mean = embeddings.mean(axis=0)
        centered = embeddings - mean
        _, _, vt = np.linalg.svd(centered, full_matrices=False)
        components = vt[:2]
        points_2d = centered @ components.T

        self.pca_mean = mean
        self.pca_components = components
        self.corpus_points_2d = [
            {
                "id": p["id"],
                "drug_name": p["drug_name"],
                "category": p["category"],
                "section": p["section"],
                "x": float(points_2d[i, 0]),
                "y": float(points_2d[i, 1]),
            }
            for i, p in enumerate(self.passages)
        ]

    def _project(self, vec) -> list[float]:
        import numpy as np

        centered = np.asarray(vec) - self.pca_mean
        xy = centered @ self.pca_components.T
        return [float(xy[0]), float(xy[1])]

    @modal.fastapi_endpoint(method="POST")
    def vector(self, body: dict):
        import numpy as np
        from fastapi import HTTPException

        _check_token(body)
        question = str(body.get("question", ""))[:500].strip()
        top_k = max(1, min(int(body.get("top_k", 5)), 10))
        if not question:
            raise HTTPException(status_code=400, detail="question is required")

        t0 = time.time()
        qvec = np.asarray(
            self.model.encode([question], normalize_embeddings=True)[0], dtype="float32"
        )
        query_point_2d = self._project(qvec)

        scores, indices = self.index.search(qvec.reshape(1, -1), top_k)
        chunks = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            p = self.passages[idx]
            chunks.append({
                "id": p["id"],
                "drug_name": p["drug_name"],
                "category": p["category"],
                "section": p["section"],
                "text": p["text"],
                "score": round(float(score), 4),
            })

        passage = "\n\n".join(c["text"] for c in chunks)
        gen = GemmaGenerator().generate.remote(passage, question)
        answer = gen["answer"]
        timing_ms = round((time.time() - t0) * 1000)
        tokens_used = _estimate_tokens(passage) + _estimate_tokens(question) + gen["output_tokens"]

        return {
            "chunks": chunks,
            "query_point_2d": {"x": query_point_2d[0], "y": query_point_2d[1]},
            "corpus_points_2d": self.corpus_points_2d,
            "answer": answer,
            "timing_ms": timing_ms,
            "tokens_used": tokens_used,
            "llm_calls": 1,
        }


@app.cls(
    image=agent_image,
    volumes=VOLUMES,
    secrets=SECRETS,
    scaledown_window=60 * 5,
    timeout=90,
)
class PageIndexRAG:
    @modal.enter()
    def load(self):
        self.pageindex = load_pageindex(config.PAGEINDEX_PATH)
        self.passages_by_id = {p["id"]: p for p in load_corpus(config.CORPUS_PATH)}

    @modal.fastapi_endpoint(method="POST")
    def pageindex(self, body: dict):
        from fastapi import HTTPException

        _check_token(body)
        question = str(body.get("question", ""))[:500].strip()
        if not question:
            raise HTTPException(status_code=400, detail="question is required")

        t0 = time.time()
        result = run_pageindex_query(
            question,
            self.pageindex,
            self.passages_by_id,
            ask_select_document=lambda q, cands: GemmaGenerator().select_document.remote(q, cands),
            ask_select_sections=lambda q, titles, max_n: GemmaGenerator().select_sections.remote(q, titles, max_n),
        )
        facts = result["facts"]
        tokens_used = result["tokens"]
        llm_calls = result["llm_calls"]

        if facts:
            passage = "\n\n".join(facts)
            gen = GemmaGenerator().generate.remote(passage, question)
            answer = gen["answer"]
            tokens_used += _estimate_tokens(passage) + _estimate_tokens(question) + gen["output_tokens"]
            llm_calls += 1
        elif result["matched_document"]:
            answer = "Matched a document in the index, but couldn't find a relevant section to ground an answer in."
        else:
            answer = "No document in the index matches this question -- nothing to ground an answer in."
        timing_ms = round((time.time() - t0) * 1000)

        return {
            "trace": result["trace"],
            "toc": result["toc"],
            "matched_document": result["matched_document"],
            "matched_sections": result["matched_sections"],
            "facts": facts,
            "answer": answer,
            "timing_ms": timing_ms,
            "tokens_used": tokens_used,
            "llm_calls": llm_calls,
        }
