import Link from "next/link";
import PipelineAnimation from "./pipeline-animation";
import ApproachAccordion from "./approach-accordion";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-14">
      <div>
        <h1 className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
          Ask it anyway, and it&apos;ll answer anyway
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/70 sm:text-base">
          A bare LLM was never trained on this demo&apos;s real DailyMed drug labels — they&apos;re
          private, niche, and irrelevant to the wider internet. Ask about them anyway, and the
          model answers regardless — fluently, confidently, and often wrong. Three things stack up
          to cause that:
        </p>
      </div>

      <TheProblem />

      <TheFix />

      <p className="max-w-2xl text-sm leading-6 text-foreground/70">
        Below: two approaches, tried on the same 51-label DailyMed corpus with the same
        answer-generating model (a self-hosted Gemma 4 2B) &mdash; only retrieval changes. Try both
        live, then compare.
      </p>

      <ApproachAccordion />

      <PipelineAnimation />

      <Link
        href="/compare"
        className="self-start rounded-full bg-gradient-to-r from-accent to-accent-2 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-accent/30 transition-opacity hover:opacity-90"
      >
        Run the same question through both →
      </Link>
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

function TheProblem() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
        The problem
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

function TheFix() {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-foreground/50 uppercase">
        So what actually works?
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/70">
        <strong className="font-semibold text-foreground">
          Retrieval-Augmented Generation
        </strong>{" "}
        &mdash; RAG &mdash; sidesteps all three problems at once: instead of trusting whatever the
        model memorized, hand it the real source document at question time and have it answer from
        that, not from memory. Suddenly there&apos;s a source to check the answer against, no
        training-time cutoff, and no long-tail rarity problem &mdash; the model just has to read,
        not know.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/70">
        But &ldquo;hand it the right document&rdquo; is itself a retrieval problem, and there&apos;s
        more than one way to solve it:
      </p>
    </div>
  );
}
