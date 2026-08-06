"""Single source of truth for the RAG vs. PageIndex-RAG demo Modal app.

Corpus: a curated ~50-label subset of DailyMed SPL drug labels (see
spl_manifest.py + spl_corpus_build.py, run locally, output pushed to the
ragdemo-index Volume via `modal volume put`).

Both retrieval strategies call the same self-hosted Gemma 4 2B (GemmaGenerator
in app.py, a Modal class in this app -- not an external service) as the
shared answer generator, so the comparison isolates retrieval, not
generation. The PageIndex lane's document/section selection steps also call
GemmaGenerator (cheaper calls) instead of an external API.
"""

from __future__ import annotations

PROJECT = "ragdemo"

# The Volume this app owns: the assembled demo corpus + the built table of contents.
INDEX_VOLUME_NAME = "ragdemo-index"
DATA_ROOT = "/data"
CORPUS_PATH = f"{DATA_ROOT}/ragdemo_corpus.jsonl"
PAGEINDEX_PATH = f"{DATA_ROOT}/pageindex.json"

# FAISS (IndexFlatIP over normalized vectors, i.e. exact cosine similarity) is
# built fresh in memory from CORPUS_PATH at container start -- no persisted
# index file, "don't want a dedicated db" per the brief. Same for the 2D PCA
# scatter projection: computed once per container from the same embeddings.
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# Secrets -- reused from the sibling SLM125/Gemma projects, plus one for the HF
# token used to pull Gemma 4 2B's weights.
SERVE_TOKEN_SECRET_NAME = "slm125live-serve-token"   # gates this app's own /vector, /pageindex
HF_SECRET_NAME = "huggingface-token"                 # HF_TOKEN env var -- same secret Gemma/config.py uses

# Self-hosted answer generator + entity-term normalizer (GemmaGenerator in app.py,
# a Modal class in this same app -- no external service, no HTTP hop). Apache-2.0,
# ungated, but HF_SECRET_NAME avoids anonymous-download rate limits.
GEMMA_MODEL_REPO = "google/gemma-4-E2B-it"
GEMMA_GPU = "A10G"
GEMMA_MAX_NEW_TOKENS = 200

# PageIndex ToC reasoning: how many top-level sections select_sections may pick per query.
PAGEINDEX_MAX_SECTIONS = 2
