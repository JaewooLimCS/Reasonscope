# ReasonScope

**A self-correcting reasoning agent built on NVIDIA Nemotron Super 120B.**

ReasonScope implements the ReAct pattern (Reason → Observe → Act → Loop) using NVIDIA Nemotron as both the reasoner and the self-critique observer. It compares three prompting methods (Direct, Chain-of-Thought, Plan-and-Solve) under 2-stage validation, with automatic feedback-driven correction up to 3 iterations.

Built for **BeaverHacks 2026 — NVIDIA Best Use of Nemotron** track.

---

## What it does

When you ask a complex question (math problem, travel itinerary, coding task), ReasonScope runs the prompt through three different reasoning strategies *in parallel* and validates each answer in two stages:

- **Stage 1 — Rule-based validator**: catches structural failures (empty output, repetition loops, mid-sentence truncation).
- **Stage 2 — LLM-as-judge**: uses the same Nemotron model to evaluate the answer along three dimensions (completeness, coherence, constraints) and produce a 1-5 score with a specific failure reason.

When validation fails, the agent automatically injects the judge's specific feedback into a follow-up prompt and retries — up to 3 iterations per method. The same Nemotron model serves as both reasoner and judge, and the user can toggle between fully autonomous correction and observable manual retry.

---

## The ReAct loop
Question
   →  Reason (Nemotron generates)
   →  Observe (Stage 1 validator + Stage 2 LLM judge)
   →  PASS → Return answer
   →  FAIL → Act (inject failure reason into corrective prompt)
   →  Loop (max 3 iterations)

---

## Why this is agentic, not just a chatbot

NVIDIA's Best Use of Nemotron track asks for *agents that reason, plan, and act* — not chatbots that respond. ReasonScope qualifies because:

- **Autonomous reasoning**: the loop decides when to retry without user prompting.
- **Multi-step workflow**: each method runs Reason → Observe → Act in iterations until the answer passes or hits the cap.
- **Tool integration**: Nemotron is invoked as both reasoner and judge — the system uses one model in two distinct agent roles.
- **Real-world applicability**: validates outputs for tasks where a single-shot LLM response is unreliable (multi-constraint planning, code with subtle bugs, math with consistency traps).

The "Auto-correct" toggle preserves manual retry as a *reasoning observability* feature: users can step through individual failure modes, or watch the agent self-correct end-to-end.

---

## Two key findings

### Finding 1 — Internal consistency hallucination is method-agnostic and judge-detectable

Across all three prompting methods, Nemotron produces answers with subtle internal contradictions that simple rule-based validation cannot catch. Real examples surfaced by the Stage 2 judge:

- *"The parking cost is counted twice in the budget calculation."*
- *"The schedule extends to 9:00 AM Sunday, which is about 2 hours beyond the requested 24-hour window."*
- *"The $148.50 total excludes lodging; unless lodging is pre-covered, the overall trip cost may exceed the $150 budget."*

These are not factual hallucinations (which would require external grounding); they are *internal* inconsistencies that an LLM judge can catch by re-reading the answer in isolation. This makes Nemotron a viable critic of its own output — a key requirement for building self-correcting agents without external tools.

### Finding 2 — Model scale changes which prompt method matters

Mid-development, we migrated the underlying model from Nemotron 3 Nano (3.2B active) to Nemotron 3 Super (12.7B active). The difference was striking on knowledge-grounded tasks like the Corvallis travel domain:

| Setting | Direct (1-shot pass rate, Corvallis) | Hallucination pattern |
|---|---|---|
| **Nano** | 0/6 attempts (required full agentic loop to converge) | Repeated fabricated addresses ("1200 SW 4th St" assigned to 5 different establishments) |
| **Super** | 1/1 attempt | Real Corvallis establishments (Marys Peak, Block 15 Brewing, Avery Park, OSU Memorial Union) with distinct addresses |

**Better models reduce the marginal value of structured prompting** — but the agentic loop remains valuable as a safety net for edge cases (truncation, occasional inconsistency). This validates NVIDIA's design philosophy of role-specializing across the Nemotron family rather than compensating for limited models with elaborate prompt scaffolding.

---

## How the three methods differ

All three methods use *identical* inference parameters (temperature=1.0, top_p=0.95, max_tokens=16384, no system prompt, zero-shot). The only difference is a trigger sentence appended to the user's question:

| Method | Trigger appended (after `\n\n`) | Citation |
|---|---|---|
| **Direct** | *(none)* | baseline |
| **Chain-of-Thought** | `Let's think step by step.` | Kojima et al. 2022 (zero-shot CoT, arXiv:2205.11916) |
| **Plan-and-Solve** | `Let's first understand the problem and devise a plan to solve the problem. Then, let's carry out the plan and solve the problem step by step.` | Wang et al. 2023 ("PS basic", arXiv:2305.04091) |

Because every other variable is controlled, performance differences across the three cards are attributable purely to prompt structure.

---

## Tech stack

- **Frontend**: Next.js 16.2.4 (App Router), React, TypeScript, Tailwind v4
- **Model**: `nvidia/nemotron-3-super-120b-a12b` via NVIDIA NIM endpoint (`https://integrate.api.nvidia.com/v1`)
- **Reasoning configuration**: `enable_thinking: true`, `reasoning_budget: 16384` (per NVIDIA's official View Code reference)
- **Validation**: in-house rule-based validator (`lib/judge.ts`) + LLM-as-judge using the same Nemotron Super (`lib/llmJudge.ts`)
- **Agentic loop**: `lib/agenticLoop.ts` — orchestrates Reason → Observe → Act with feedback injection

---

## Run locally

Prerequisites: Node.js 20+, an NVIDIA NGC API key with access to Nemotron 3 Super.

```bash
git clone https://github.com/JaewooLimCS/Reasonscope.git
cd Reasonscope
npm install

cp .env.local.example .env.local
# Edit .env.local and add your NVIDIA_API_KEY

npm run dev
```

Visit `http://localhost:3000` and try one of the preset domains (Math, Planning, Coding) or your own prompt.

---

## Limitations

- **No external factuality grounding**: the judge catches *internal* inconsistencies but cannot verify whether named entities (restaurants, trails, etc.) actually exist. Adding retrieval-augmented validation (e.g., Google Places API) is the natural next step.
- **Truncation false positives**: the rule-based validator's truncation heuristic occasionally flags well-formed long structured outputs as truncated. The agentic loop's max-iteration cap surfaces the final answer with a "max iterations reached" banner rather than blocking the user.
- **Latency**: with reasoning_budget=16384, a single iteration takes 30-100 seconds. Three methods run in parallel; worst case (3 iterations × all methods failing) is ~75-300 seconds. Acceptable for demonstration; production deployments would tune the budget.
- **No streaming**: in-flight iteration progress is not surfaced — the full history materializes when the loop finishes. Adding SSE streaming would improve interactivity.
- **Same-model judging**: using Nemotron to judge Nemotron has known biases (the model may be lenient on its own reasoning style). Cross-model judging (e.g., Nemotron answers, GPT-class judge) would strengthen the validation signal.

---

## Acknowledgments

- Built for **BeaverHacks 2026** — Oregon State University's hackathon.
- Submitted to the **NVIDIA Best Use of Nemotron** track.
- Powered by **NVIDIA Nemotron 3 Super 120B-A12B** via NVIDIA NIM.

## Author

**Jaewoo Lim** — [@JaewooLimCS](https://github.com/JaewooLimCS)

## License

MIT — see [LICENSE](./LICENSE).
