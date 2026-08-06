import Link from "next/link";
import PipelineAnimation from "./pipeline-animation";
import ApproachAccordion from "./approach-accordion";
import QuizSection from "./quiz-section";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-14">
      <div>
        <h1 className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
          RAG vs. PageIndex RAG
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/70 sm:text-base">
          Two ways to ground an LLM in documents it wasn&apos;t trained on. Same corpus (real
          DailyMed drug labels), same answer-generating model (a self-hosted Gemma 4 2B) &mdash; the
          only thing that changes is <em>how the relevant facts get found</em>. Try both live, then
          compare.
        </p>
      </div>

      <WhyRag />

      <VectorLimitToPitch />

      <ApproachAccordion />

      <PipelineAnimation />

      <div className="rounded-2xl border border-surface-border bg-surface p-5">
        <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
          The corpus
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground/70">
          51 curated DailyMed drug labels (prescription, OTC, animal, and homeopathic) — 598
          section-level passages spanning indications, dosage, warnings, contraindications, and
          drug interactions. Includes a couple of genuine look-alike/sound-alike drug-name pairs
          (hydrALAZINE vs. hydrOXYzine, clonazePAM vs. cloNIDine) used later on the Compare tab.
        </p>
      </div>

      <Link
        href="/compare"
        className="self-start rounded-full bg-gradient-to-r from-accent to-accent-2 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-accent/30 transition-opacity hover:opacity-90"
      >
        Run the same question through both →
      </Link>

      <QuizSection />
    </div>
  );
}

const LIMITATIONS = [
  {
    label: "Frozen at training time",
    detail: "Weights stop updating the moment training ends. Anything after that — or anything private, like this demo's drug labels — simply isn't in there.",
  },
  {
    label: "Rewarded for guessing",
    detail: "Training and grading score a confident wrong answer the same as a right one, and a blank the same as a wrong one — so the model learns to never leave a blank.",
  },
  {
    label: "Thin on rare facts",
    detail: "A fact has to repeat often across training data to stick at all. One that barely appears — like a single OTC label's dosing table — mostly doesn't.",
  },
];

const WHY_RAG_FACTS = [
  {
    body: "OpenAI's own 2025 hallucination paper puts it bluntly: models hallucinate because training and grading reward a confident guess over an honest “I don’t know” — the same way a multiple-choice test-taker guesses rather than leaves a blank, since a blank scores zero too.",
    source: "Kalai, Nachum, Vempala & Zhang, “Why Language Models Hallucinate,” OpenAI, Sept 2025",
    href: "https://openai.com/index/why-language-models-hallucinate/",
  },
  {
    body: "Model size alone doesn't fix this. Researchers found a model needs to be scaled by orders of magnitude just to get competitive answers on facts with thin support in its training data — and a 51-label niche drug corpus like this demo's has essentially none.",
    source: "Kandpal, Deng, Roberts, Wallace & Raffel, “Large Language Models Struggle to Learn Long-Tail Knowledge,” ICML 2023",
    href: "https://arxiv.org/abs/2211.08411",
  },
];

function WhyRag() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
        Why bother grounding the model at all?
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/70">
        Ask a bare LLM about this demo&apos;s drug labels and it&apos;ll answer anyway — fluently,
        confidently, and often wrong. Three things stack up to cause that:
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {LIMITATIONS.map((l) => (
          <div key={l.label} className="rounded-lg border border-surface-border bg-background/40 p-2.5">
            <p className="text-xs font-semibold text-foreground">{l.label}</p>
            <p className="mt-1 text-[11px] leading-4 text-foreground/60">{l.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-foreground/40">
        <span>all three feed into</span>
      </div>
      <div
        className="mx-auto mt-1 w-fit rounded-lg border px-3 py-1.5 text-center text-[11px] font-medium"
        style={{ borderColor: "var(--accent-2)", color: "var(--accent-2)" }}
      >
        a fluent answer, with no source to check it against
      </div>

      <div className="mt-5 grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-2">
        {WHY_RAG_FACTS.map((f) => (
          <div key={f.href} className="text-[11px] leading-5 text-foreground/60">
            <p>{f.body}</p>
            <a
              href={f.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10px] italic text-foreground/40 underline decoration-dotted underline-offset-2 hover:text-foreground/60"
            >
              {f.source} →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function VectorLimitToPitch() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
        So RAG fixes it&nbsp;&mdash; but which kind?
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/70">
        Vector RAG grounds the model in real documents, but grounding isn&apos;t the same as
        grounding <em>correctly</em>. It searches by how close two pieces of text sit in
        embedding space &mdash; and closeness there doesn&apos;t always mean the same thing as
        closeness in meaning.
      </p>

      <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-surface-border bg-background/40 p-3 sm:flex-row sm:justify-center">
        <DrugChip name="hydrALAZINE" note="a blood-pressure vasodilator" />
        <span className="whitespace-nowrap text-center text-[11px] font-medium" style={{ color: "var(--vector)" }}>
          share &ldquo;hydr…azine&rdquo;-shaped subword tokens →<br className="hidden sm:block" />
          sit closer in vector space than they should
        </span>
        <DrugChip name="hydrOXYzine" note="an antihistamine for anxiety" />
      </div>
      <p className="mt-2 text-center text-[11px] italic text-foreground/40">
        A real pair from the{" "}
        <a
          href="https://www.ismp.org/system/files/resources/2023-10/ISMP_ConfusedDrugNames_2023.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-foreground/60"
        >
          ISMP List of Confused Drug Names
        </a>{" "}
        &mdash; the odd mid-word capitalization above is &ldquo;tall-man lettering,&rdquo; the
        FDA/ISMP&apos;s own fix for this exact mix-up. Ask about one drug and a similarity search
        can still hand back a passage from the other.
      </p>

      <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground/70">
        The embedding model never reads the label &mdash; it only ever sees a vector, computed once,
        divorced from the question being asked. What if retrieval worked the way a pharmacist
        actually would: read the drug&apos;s real name, go to{" "}
        <em>that document specifically</em>, then to the section that would hold the answer? No
        vector space to get confused in &mdash; that&apos;s the intuition behind PageIndex RAG,
        below.
      </p>
    </div>
  );
}

function DrugChip({ name, note }: { name: string; note: string }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-center" style={{ borderColor: "var(--vector)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--vector)" }}>
        {name}
      </p>
      <p className="text-[10px] text-foreground/50">{note}</p>
    </div>
  );
}


