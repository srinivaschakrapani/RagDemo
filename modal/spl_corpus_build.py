"""Local one-time script: turn the curated DailyMed SPL label subset
(spl_manifest.LABELS) into modal/ragdemo_corpus.jsonl.

Not a Modal job -- this reads zips straight off the local DailyMed download
directory, so it runs on your machine with a throwaway venv (`pip install
lxml`), then the resulting JSONL gets pushed to the ragdemo-index Volume via
`modal volume put` (see the printed instructions at the end).

SPL XML shape (HL7 v3): each label document is a tree of
<component><section> blocks, each section carrying a <code displayName="...">
(from the SPL/LOINC section-code vocabulary) and a <text> element holding the
actual prose (plus a redundant <excerpt><highlight> bullet summary, which we
skip). We keep only clinically load-bearing sections -- indications, dosing,
contraindications, warnings, interactions, overdosage, and the OTC Drug-Facts
equivalents -- and drop boilerplate (package labeling, storage/handling,
pharmacology deep-dives) to keep the demo corpus small and legible.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path

from lxml import etree

from spl_manifest import LABELS

SOURCE_ROOT = Path("/Users/srinivaschakrapani/Downloads/dm_spl_monthly_update_jul2026")
OUT_PATH = Path(__file__).parent / "ragdemo_corpus.jsonl"

# Case-insensitive substrings matched against each section's <code displayName>.
SECTION_KEEP_PATTERNS = [
    "INDICATIONS",
    "DOSAGE",
    "CONTRAINDICATIONS",
    "WARNING",
    "ADVERSE REACTIONS",
    "DRUG INTERACTIONS",
    "OVERDOSAGE",
    "ACTIVE INGREDIENT",
    "PURPOSE",
    "DO NOT USE",
    "ASK DOCTOR",
    "STOP USE",
    "PREGNANCY",
    "INFORMATION FOR PATIENTS",
]

PASSAGE_WORDS = 500  # cap, not a window -- one passage per structural section (see Chunking tab)
MIN_SECTION_CHARS = 40
MAX_PASSAGES_PER_LABEL = 14  # long monographs (vaccines, biologics) nest dozens of sub-sections;
# document order already puts indications/dosing/warnings/interactions first, so a flat cap keeps
# the clinically load-bearing passages and drops only deep tail content (e.g. 5th adverse-event table)
MAX_DIGIT_RATIO = 0.15  # adverse-event frequency tables ("Fatigue 9 6 7 7 7 4 ...") embed poorly


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _clean_text(el: etree._Element) -> str:
    text = " ".join(t.strip() for t in el.itertext() if t.strip())
    return re.sub(r"\s+", " ", text).strip()


def _drug_name(root: etree._Element, fallback: str) -> str:
    for mp in root.iter():
        if _local(mp.tag) == "manufacturedProduct":
            for name_el in mp.iter():
                if _local(name_el.tag) == "name" and name_el.text and name_el.text.strip():
                    return name_el.text.strip()
    return fallback


def _walk_sections(el: etree._Element, inherited_label: str | None, out: list[tuple[str, str]]) -> None:
    """Recursively walks <section> elements, inheriting a whitelisted label
    down into unlabeled/"SPL UNCLASSIFIED SECTION" children. Some SPL docs
    (e.g. Clonazepam) nest the real prose one level down -- a top section
    like "INDICATIONS & USAGE SECTION" has no direct <text>, only child
    sections titled "Seizure Disorders:" / "Panic Disorder:" that carry the
    actual content -- so a purely flat, non-recursive scan misses them."""
    for child in el:
        if _local(child.tag) != "section":
            _walk_sections(child, inherited_label, out)
            continue

        code_el = text_el = title_el = None
        for c in child:
            local = _local(c.tag)
            if local == "code" and code_el is None:
                code_el = c
            elif local == "text" and text_el is None:
                text_el = c
            elif local == "title" and title_el is None:
                title_el = c

        display_name = code_el.get("displayName", "") if code_el is not None else ""
        matches = any(p.lower() in display_name.lower() for p in SECTION_KEEP_PATTERNS)

        if matches:
            label: str | None = display_name.replace(" SECTION", "").strip().title()
        elif inherited_label and "UNCLASSIFIED" in display_name.upper() and title_el is not None:
            sub_title = _clean_text(title_el).rstrip(":")
            label = f"{inherited_label} – {sub_title}" if sub_title and len(sub_title) < 60 else inherited_label
        else:
            label = inherited_label

        if label and text_el is not None:
            text = _clean_text(text_el)
            if len(text) >= MIN_SECTION_CHARS:
                out.append((label, text))

        _walk_sections(child, label, out)


def _sections(root: etree._Element) -> list[tuple[str, str]]:
    """Returns [(section_label, text), ...] for whitelisted sections (and
    their meaningfully-titled sub-sections)."""
    out: list[tuple[str, str]] = []
    _walk_sections(root, None, out)
    return out


def _cap_words(text: str, n: int) -> str:
    words = text.split()
    if len(words) <= n:
        return text
    return " ".join(words[:n]) + " …"


def _is_table_like(text: str) -> bool:
    digits = sum(c.isdigit() for c in text)
    return digits / max(1, len(text)) > MAX_DIGIT_RATIO


def extract_zip(category: str, zip_name: str, expected_name: str, tmp_dir: Path) -> list[dict]:
    zip_path = SOURCE_ROOT / category / zip_name
    with zipfile.ZipFile(zip_path) as zf:
        xml_names = [n for n in zf.namelist() if n.lower().endswith(".xml")]
        if not xml_names:
            print(f"  ! no xml in {zip_name}", file=sys.stderr)
            return []
        with zf.open(xml_names[0]) as fh:
            root = etree.parse(fh).getroot()

    drug_name = _drug_name(root, expected_name)
    sections = _sections(root)
    if not sections:
        print(f"  ! no whitelisted sections in {zip_name} ({expected_name})", file=sys.stderr)
        return []

    records = []
    for section_label, text in sections:
        if _is_table_like(text):
            continue
        records.append(
            {
                "drug_name": drug_name,
                "category": category,
                "section": section_label,
                "text": _cap_words(text, PASSAGE_WORDS),
            }
        )
        if len(records) >= MAX_PASSAGES_PER_LABEL:
            break
    return records


def main() -> None:
    all_records: list[dict] = []
    for category, zip_name, expected_name in LABELS:
        recs = extract_zip(category, zip_name, expected_name, OUT_PATH.parent)
        print(f"{category:12s} {expected_name:35s} -> {len(recs)} passages")
        all_records.extend(recs)

    for i, rec in enumerate(all_records):
        rec["id"] = i

    with OUT_PATH.open("w", encoding="utf-8") as fh:
        for rec in all_records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    drugs = sorted({r["drug_name"] for r in all_records})
    print(f"\nWrote {len(all_records)} passages across {len(drugs)} labels -> {OUT_PATH}")
    print("\nNext: modal volume put ragdemo-index", OUT_PATH, "/ragdemo_corpus.jsonl")


if __name__ == "__main__":
    main()
