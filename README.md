# ReasonScope

Multi-method reasoning observability with NVIDIA Nemotron. BeaverHacks 2026.

## Setup

1. `cp .env.local.example .env.local` and fill in your `NVIDIA_API_KEY` (NVIDIA NIM key, format `nvapi-...`).
2. `npm install`
3. `npm run dev`

Open `http://localhost:3000`, type a question, and submit. The page POSTs to `/api/reason`, which calls Nemotron three times in parallel (one per method) and returns the raw JSON.

## Methods

Three zero-shot reasoning prompt methods, all run against the same model with reasoning OFF:

- **Direct** — the question, verbatim. No citation (baseline).
- **Chain-of-Thought** — appends `Let's think step by step.`
  - Wei et al. 2022 (arXiv:2201.11903); Kojima et al. 2022 (arXiv:2205.11916, zero-shot trigger variant).
- **Plan-and-Solve** — appends `Let's first understand the problem and devise a plan to solve the problem. Then, let's carry out the plan and solve the problem step by step.`
  - Wang et al. 2023 (arXiv:2305.04091, Section 2.1, "PS basic").

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind v4
- OpenAI SDK pointed at NVIDIA NIM (`https://integrate.api.nvidia.com/v1`)
- Model: `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`

## Scripts

Reasoning-mode sanity check (compares OFF vs system-toggle ON vs `extra_body` ON):

```bash
npx tsx scripts/test-reasoning-on.ts
```
