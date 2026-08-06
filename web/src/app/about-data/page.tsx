import Link from "next/link";
import { CodeBlock } from "../shared";
import type { ThemeColor } from "../shared";

const XML_SNIPPET = `<document xmlns="urn:hl7-org:v3">
  <id root="557bfedd-1dff-a1ff-e063-6294a90ad7bc"/>
  <code code="34390-5" displayName="HUMAN OTC DRUG LABEL"/>
  <title>ENEMEEZ MINI ENEMA 5ml Disposable Tubes</title>
  <effectiveTime value="20260630"/>
  <setId root="0b06445d-0839-497e-bdff-e0fe224a7738"/>
  <versionNumber value="20"/>

  <author>...</author>              <!-- manufacturer -->

  <component>
    <structuredBody>
      <component>
        <section>
          <id root="b3c505cf-c787-..."/>
          <code code="34067-9" displayName="INDICATIONS & USAGE SECTION"/>
          <title><content styleCode="bold">Uses</content></title>
          <text>
            <list listType="unordered">
              <item>For relief of occasional constipation (irregularity).</item>
            </list>
          </text>
          <effectiveTime value="20160628"/>
        </section>
      </component>
      <!-- ...repeated <component><section> for every labeled section... -->
    </structuredBody>
  </component>
</document>`;

type CodeSystemRow = { oid: string; name: string; example: string; meaning: string };

const CODE_SYSTEMS: CodeSystemRow[] = [
  {
    oid: "2.16.840.1.113883.6.1",
    name: "LOINC",
    example: '34067-9 → "INDICATIONS & USAGE SECTION"',
    meaning: "Identifies the document type and every section type — this is what section labels in the corpus are built from.",
  },
  {
    oid: "2.16.840.1.113883.6.69",
    name: "NDC (National Drug Code)",
    example: "17433-9876-3",
    meaning: "FDA's product/package identifier — labeler, product, and package size baked into one code.",
  },
  {
    oid: "2.16.840.1.113883.4.9",
    name: "UNII (Substance Registration)",
    example: 'F05Q2T2JA0 → "DOCUSATE SODIUM"',
    meaning: "Unique identifier for each active/inactive ingredient and active moiety.",
  },
  {
    oid: "2.16.840.1.113883.3.26.1.1",
    name: "FDA SPL terminology (NCI Thesaurus)",
    example: 'C38295 → "RECTAL", C42953 → "LIQUID"',
    meaning: "Controlled vocabulary for form codes, route codes, and marketing/approval status.",
  },
];

type SectionRow = { code: string; name: string; title: string; kept: boolean };

const SECTIONS: SectionRow[] = [
  { code: "48780-1", name: "SPL product data elements section", title: "—", kept: false },
  { code: "55106-9", name: "OTC – Active Ingredient section", title: "Drug Facts", kept: true },
  { code: "55105-1", name: "OTC – Purpose section", title: "Purpose", kept: true },
  { code: "34067-9", name: "Indications & Usage section", title: "Uses", kept: true },
  { code: "34071-1", name: "Warnings section", title: "Warnings", kept: true },
  { code: "50570-1", name: "OTC – Do Not Use section", title: "Do not use", kept: true },
  { code: "50566-9", name: "OTC – Stop Use section", title: "Stop use and ask a doctor if…", kept: true },
  { code: "53414-9", name: "OTC – Pregnancy or Breast Feeding section", title: "—", kept: true },
  { code: "50565-1", name: "OTC – Keep Out of Reach of Children section", title: "—", kept: false },
  { code: "34068-7", name: "Dosage & Administration section", title: "Directions", kept: true },
  { code: "44425-7", name: "Storage and Handling section", title: "Other Information", kept: false },
  { code: "51727-6", name: "Inactive Ingredient section", title: "Inactive Ingredients", kept: false },
  { code: "53413-1", name: "OTC – Questions section", title: "Questions or Comments", kept: false },
  { code: "51945-4", name: "Package Label.Principal Display Panel", title: "—", kept: false },
];

const LANES: {
  color: ThemeColor;
  title: string;
  href: string;
  points: string[];
}[] = [
  {
    color: "vector",
    title: "Vector RAG",
    href: "/vector",
    points: [
      "Every kept passage is embedded once, offline, with a local MiniLM model and held in a FAISS index.",
      "At query time the question is embedded too and FAISS returns the nearest passages by cosine similarity.",
    ],
  },
  {
    color: "pageindex",
    title: "PageIndex RAG",
    href: "/pageindex",
    points: [
      "No LLM at build time — kept passages are regrouped by drug into a two-level table of contents (section → sub-section).",
      "At query time an LLM reasons over the ToC to pick the right document, then the right section(s), before reading the full text.",
    ],
  },
];

type ExternalLink = { href: string; label: string; blurb: string };

const EXTERNAL_LINKS: ExternalLink[] = [
  {
    href: "https://dailymed.nlm.nih.gov/dailymed/",
    label: "DailyMed",
    blurb: "NIH/NLM's public site for browsing and downloading the source SPL labels, including the monthly-update dumps this corpus was built from.",
  },
  {
    href: "https://www.fda.gov/industry/fda-resources-data-standards/structured-product-labeling-resources",
    label: "FDA — Structured Product Labeling Resources",
    blurb: "The FDA's official SPL program page: submission requirements, implementation guides, and validation tools.",
  },
  {
    href: "https://www.accessdata.fda.gov/spl/schema/spl.xsd",
    label: "spl.xsd (the actual schema)",
    blurb: "The XSD every label in the corpus validates against — the source of truth for the nesting and vocabularies described above.",
  },
  {
    href: "https://loinc.org/",
    label: "LOINC",
    blurb: "The code system behind every section's displayName (e.g. \"INDICATIONS & USAGE SECTION\") and the document-type code.",
  },
  {
    href: "https://www.accessdata.fda.gov/scripts/cder/ndc/",
    label: "NDC Directory",
    blurb: "FDA's National Drug Code lookup — resolves the product/package codes (e.g. 17433-9876-3) seen in each label.",
  },
  {
    href: "https://gsrs.ncats.nih.gov/",
    label: "FDA/NCATS Global Substance Registration System",
    blurb: "Look up any UNII (e.g. F05Q2T2JA0) to see the full ingredient/active-moiety record behind it.",
  },
];

export default function AboutDataPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
          About the Data
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/70">
          Everything in this demo — Vector and PageIndex RAG — is built from the same corpus of
          real FDA drug labels. This page explains where that corpus comes from, what the raw
          label documents look like, and which parts of them actually feed the demo.
        </p>
      </div>

      <section className="rounded-2xl border border-surface-border bg-surface p-5">
        <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">Where it comes from</p>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          The source is DailyMed&apos;s SPL (Structured Product Labeling) monthly-update dump — the
          same XML the FDA publishes for every drug label sold in the US. From that dump, 51 labels
          were hand-curated across five categories (prescription, OTC, animal, homeopathic, other),
          including two genuine look-alike/sound-alike drug-name pairs (hydrALAZINE vs.
          hydrOXYzine, clonazePAM vs. cloNIDine) used later on the Compare tab.
        </p>
      </section>

      <section>
        <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
          Anatomy of an SPL document
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          Each label is one HL7 v3 XML document: document-level metadata (a title, an effective
          date, a version number), a manufacturer block, then a{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">structuredBody</code>{" "}
          made of repeating{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">&lt;section&gt;</code>{" "}
          blocks. Every section carries a LOINC-coded{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">code[displayName]</code>{" "}
          identifying what kind of content it holds, plus the actual prose in{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">&lt;text&gt;</code>.
          Trimmed excerpt from an OTC label:
        </p>
        <div className="mt-3">
          <CodeBlock>{XML_SNIPPET}</CodeBlock>
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
          What the XSD actually constrains
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          Every label declares{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">
            xsi:schemaLocation=&quot;urn:hl7-org:v3 .../spl/schema/spl.xsd&quot;
          </code>{" "}
          — the FDA-published XSD that every submitted label must validate against. It&apos;s not a
          free-form document format: it&apos;s derived from HL7&apos;s Clinical Document Architecture
          (CDA), the same reference model used for clinical documents like discharge summaries. The
          schema fixes two things: the{" "}
          <span className="text-foreground/90">nesting</span> (document → author → component →
          structuredBody → repeating section, and nothing outside that shape validates), and the{" "}
          <span className="text-foreground/90">vocabularies</span> — every{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">&lt;code&gt;</code>{" "}
          element must point at a registered code system (an OID) rather than an arbitrary string.
          The ones that show up constantly in these labels:
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-background/40 text-foreground/50">
                <th className="px-3 py-2 font-medium">OID</th>
                <th className="px-3 py-2 font-medium">Code system</th>
                <th className="px-3 py-2 font-medium">Example</th>
                <th className="px-3 py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {CODE_SYSTEMS.map((c) => (
                <tr key={c.oid} className="border-b border-surface-border last:border-0">
                  <td className="px-3 py-2 font-mono text-foreground/60">{c.oid}</td>
                  <td className="px-3 py-2 text-foreground/80">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-foreground/60">{c.example}</td>
                  <td className="px-3 py-2 text-foreground/60">{c.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground/70">
          The schema also distinguishes three identity fields that are easy to conflate:{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">id</code> is unique to
          this exact revision of the document,{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">setId</code> stays
          constant across every revision of the same label (it&apos;s what ties a label&apos;s full
          history together on DailyMed), and{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">versionNumber</code>{" "}
          increments by one each time the labeler resubmits. None of this identity/vocabulary
          machinery is used by the demo directly — the corpus build only reads section{" "}
          <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">displayName</code>{" "}
          strings and <code className="rounded bg-background/60 px-1 py-0.5 text-[11px]">text</code>{" "}
          content — but it&apos;s why the LOINC display names are consistent enough across 51
          different manufacturers&apos; labels to pattern-match on in the first place.
        </p>
      </section>

      <section>
        <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
          What&apos;s kept vs. dropped
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          Not every section is clinically useful for Q&amp;A. The corpus build keeps only the
          load-bearing ones — indications, dosage, warnings, contraindications, interactions,
          active ingredient, purpose, and similar — and drops boilerplate like packaging metadata,
          storage instructions, the printed package label, and contact info. Here&apos;s every
          section found in one example OTC label, and whether it made it into the corpus:
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-background/40 text-foreground/50">
                <th className="px-3 py-2 font-medium">LOINC code</th>
                <th className="px-3 py-2 font-medium">Section</th>
                <th className="px-3 py-2 font-medium">Title shown</th>
                <th className="px-3 py-2 font-medium">In corpus?</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((s) => (
                <tr key={s.code} className="border-b border-surface-border last:border-0">
                  <td className="px-3 py-2 font-mono text-foreground/60">{s.code}</td>
                  <td className="px-3 py-2 text-foreground/80">{s.name}</td>
                  <td className="px-3 py-2 text-foreground/60">{s.title}</td>
                  <td className="px-3 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ background: s.kept ? "var(--pageindex)" : "var(--surface-border)" }}
                    >
                      {s.kept ? "kept" : "dropped"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
          One corpus, two retrieval lanes
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          Both RAG strategies in this demo read the exact same kept passages — they just process
          them differently downstream:
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {LANES.map((lane) => (
            <div key={lane.title} className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface p-4">
              <h3 className="text-sm font-bold" style={{ color: `var(--${lane.color})` }}>
                {lane.title}
              </h3>
              <ul className="flex flex-col gap-2 text-xs leading-5 text-foreground/70">
                {lane.points.map((p, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span
                      className="mt-1 h-1 w-1 shrink-0 rounded-full"
                      style={{ background: `var(--${lane.color})` }}
                    />
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                href={lane.href}
                className="mt-1 self-start text-xs font-medium underline decoration-dotted underline-offset-2"
                style={{ color: `var(--${lane.color})` }}
              >
                Try it →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
          Verify it yourself — authoritative sources
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          Nothing above is proprietary — every code, schema, and label referenced on this page is
          publicly published. Cross-check any of it directly:
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {EXTERNAL_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-0.5 rounded-lg border border-surface-border bg-surface px-3 py-2.5 transition-colors hover:border-foreground/40"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {l.label}
                <span className="text-xs text-foreground/40">↗</span>
              </span>
              <span className="text-xs leading-5 text-foreground/60">{l.blurb}</span>
            </a>
          ))}
        </div>
      </section>

      <Link
        href="/chunking"
        className="self-start rounded-full bg-gradient-to-r from-accent to-accent-2 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-accent/30 transition-opacity hover:opacity-90"
      >
        See how a kept section gets chunked →
      </Link>
    </div>
  );
}
