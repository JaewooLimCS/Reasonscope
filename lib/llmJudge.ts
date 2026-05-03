import { callNemotron } from './nemotron';

export interface LLMJudgeVerdict {
  passed: boolean;
  score: number;
  completeness: 'PASS' | 'FAIL';
  completenessReason: string;
  coherence: 'PASS' | 'FAIL';
  coherenceReason: string;
  constraints: 'PASS' | 'FAIL';
  constraintsReason: string;
  verdict: 'ACCEPT' | 'REJECT';
  rawJudgeResponse: string;
  judgeLatencyMs: number;
}

function buildJudgePrompt(question: string, response: string): string {
  return `You are an evaluator. Given a user query and a model's response, evaluate the response on three criteria. Output ONLY valid JSON, no preamble, no markdown.

USER QUERY:
"""
${question}
"""

MODEL RESPONSE:
"""
${response}
"""

Evaluate on:
1. completeness: Does the response address every explicit requirement of the user's query? (PASS/FAIL)
2. coherence: Is the response internally consistent, free of contradictions or repetitions? (PASS/FAIL)
3. constraints: Does the response satisfy explicit numeric/factual constraints in the query (budgets, time limits, distances, etc.)? (PASS/FAIL)

Then provide:
- score: 1-5 (5 = excellent, 1 = unusable)
- verdict: ACCEPT (score >= 4 AND all three criteria PASS) or REJECT (otherwise)

Output ONLY this JSON shape, no extra text:
{
  "completeness": "PASS",
  "completeness_reason": "brief 1-sentence explanation",
  "coherence": "PASS",
  "coherence_reason": "...",
  "constraints": "PASS",
  "constraints_reason": "...",
  "score": 4,
  "verdict": "ACCEPT"
}`;
}

function syntheticFail(detail: string, raw: string, latencyMs: number): LLMJudgeVerdict {
  return {
    passed: false,
    score: 1,
    completeness: 'FAIL',
    completenessReason: detail,
    coherence: 'FAIL',
    coherenceReason: detail,
    constraints: 'FAIL',
    constraintsReason: detail,
    verdict: 'REJECT',
    rawJudgeResponse: raw,
    judgeLatencyMs: latencyMs,
  };
}

function extractJsonObject(text: string): unknown | null {
  // Greedy match for the outermost {...} block — judge prompts often emit a single JSON object.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function isPassFail(v: unknown): v is 'PASS' | 'FAIL' {
  return v === 'PASS' || v === 'FAIL';
}
function isVerdict(v: unknown): v is 'ACCEPT' | 'REJECT' {
  return v === 'ACCEPT' || v === 'REJECT';
}

export async function llmJudge(
  question: string,
  response: string,
): Promise<LLMJudgeVerdict> {
  const start = performance.now();
  let raw = '';
  try {
    const result = await callNemotron(buildJudgePrompt(question, response));
    // Judge JSON may land in content or, less commonly, leak into reasoning_content.
    raw = result.response || result.reasoningContent || '';
    const latencyMs = performance.now() - start;

    const parsed = extractJsonObject(result.response) ?? extractJsonObject(result.reasoningContent);
    if (!parsed || typeof parsed !== 'object') {
      return syntheticFail('Judge returned no parseable JSON', raw, latencyMs);
    }
    const p = parsed as Record<string, unknown>;
    if (
      !isPassFail(p.completeness) ||
      !isPassFail(p.coherence) ||
      !isPassFail(p.constraints) ||
      typeof p.score !== 'number' ||
      !isVerdict(p.verdict)
    ) {
      return syntheticFail('Judge JSON missing required fields', raw, latencyMs);
    }

    const verdict = p.verdict;
    return {
      passed: verdict === 'ACCEPT',
      score: p.score,
      completeness: p.completeness,
      completenessReason: typeof p.completeness_reason === 'string' ? p.completeness_reason : '',
      coherence: p.coherence,
      coherenceReason: typeof p.coherence_reason === 'string' ? p.coherence_reason : '',
      constraints: p.constraints,
      constraintsReason: typeof p.constraints_reason === 'string' ? p.constraints_reason : '',
      verdict,
      rawJudgeResponse: raw,
      judgeLatencyMs: latencyMs,
    };
  } catch (err) {
    const latencyMs = performance.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return syntheticFail(`Judge call failed: ${message}`, raw, latencyMs);
  }
}
