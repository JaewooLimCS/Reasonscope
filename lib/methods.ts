import { callNemotron } from './nemotron';
import { judge } from './judge';
import { llmJudge } from './llmJudge';
import type {
  AttemptRecord,
  Method,
  MethodMeta,
  MethodResult,
} from '@/types/reasoning';
import type { JudgeVerdict } from './judge';
import type { LLMJudgeVerdict } from './llmJudge';

const COT_CITATION =
  'Wei et al. 2022 (arXiv:2201.11903); Kojima et al. 2022 (arXiv:2205.11916, zero-shot trigger variant)';
const PAS_CITATION = 'Wang et al. 2023 (arXiv:2305.04091, Section 2.1, "PS basic")';

export const METHODS: MethodMeta[] = [
  { id: 'direct', name: 'Direct', citation: null },
  { id: 'cot', name: 'Chain-of-Thought', citation: COT_CITATION },
  { id: 'pas', name: 'Plan-and-Solve', citation: PAS_CITATION },
];

const COT_TRIGGER = "Let's think step by step.";
const PAS_TRIGGER =
  "Let's first understand the problem and devise a plan to solve the problem. Then, let's carry out the plan and solve the problem step by step.";

export function methodTrigger(method: Method): string {
  switch (method) {
    case 'direct':
      return '';
    case 'cot':
      return COT_TRIGGER;
    case 'pas':
      return PAS_TRIGGER;
  }
}

export function methodCitation(method: Method): string | null {
  switch (method) {
    case 'direct':
      return null;
    case 'cot':
      return COT_CITATION;
    case 'pas':
      return PAS_CITATION;
  }
}

export function buildMethodPrompt(method: Method, question: string): string {
  const trigger = methodTrigger(method);
  return trigger ? `${question}\n\n${trigger}` : question;
}

function buildAttempt({
  previousAttempts,
  validatorVerdict,
  llmJudgeVerdict,
  responseLength,
  latencyMs,
  outcome,
  outcomeDetail,
}: {
  previousAttempts: AttemptRecord[];
  validatorVerdict: JudgeVerdict;
  llmJudgeVerdict?: LLMJudgeVerdict;
  responseLength: number;
  latencyMs: number;
  outcome: AttemptRecord['outcome'];
  outcomeDetail: string;
}): AttemptRecord {
  return {
    attemptNumber: previousAttempts.length + 1,
    timestamp: Date.now(),
    validatorVerdict,
    llmJudgeVerdict,
    responseLength,
    latencyMs,
    judgeLatencyMs: llmJudgeVerdict?.judgeLatencyMs,
    outcome,
    outcomeDetail,
  };
}

export async function runMethod(
  method: Method,
  question: string,
  prompt: string,
  citation: string | null,
  previousAttempts: AttemptRecord[] = [],
): Promise<MethodResult> {
  try {
    const {
      response,
      reasoningContent,
      tokens,
      reasoningTokens,
      answerTokens,
      latencyMs,
    } = await callNemotron(prompt);

    // Stage 1: rule-based validator.
    const verdict = judge(response);
    if (!verdict.passed) {
      console.log(
        `[validator] ${method} flagged: ${verdict.failureMode} — ${verdict.detail}`,
      );
      const attempt = buildAttempt({
        previousAttempts,
        validatorVerdict: verdict,
        responseLength: response.length,
        latencyMs,
        outcome: 'validator_fail',
        outcomeDetail: `Validator: ${verdict.failureMode} — ${verdict.detail}`,
      });
      console.log(
        `[runMethod ${method}] return path=validator_fail attempts.length=${previousAttempts.length + 1} prev=${previousAttempts.length}`,
      );
      return {
        method,
        prompt,
        response,
        reasoningContent,
        tokens,
        reasoningTokens,
        answerTokens,
        latencyMs,
        citation,
        error: `Validator flagged ${verdict.failureMode}: ${verdict.detail}`,
        judgeVerdict: verdict,
        attempts: [...previousAttempts, attempt],
      };
    }

    // Stage 2: LLM-as-judge (Nemotron-as-judge for Nemotron).
    const llmVerdict = await llmJudge(question, response);
    if (!llmVerdict.passed) {
      const reason =
        llmVerdict.completeness === 'FAIL'
          ? llmVerdict.completenessReason
          : llmVerdict.coherence === 'FAIL'
            ? llmVerdict.coherenceReason
            : llmVerdict.constraintsReason;
      console.log(
        `[llmJudge] ${method} rejected: score=${llmVerdict.score}/5 — ${reason}`,
      );
      const attempt = buildAttempt({
        previousAttempts,
        validatorVerdict: verdict,
        llmJudgeVerdict: llmVerdict,
        responseLength: response.length,
        latencyMs,
        outcome: 'judge_reject',
        outcomeDetail: `Judge ${llmVerdict.score}/5 — ${reason}`,
      });
      console.log(
        `[runMethod ${method}] return path=judge_reject attempts.length=${previousAttempts.length + 1} prev=${previousAttempts.length}`,
      );
      return {
        method,
        prompt,
        response,
        reasoningContent,
        tokens,
        reasoningTokens,
        answerTokens,
        latencyMs,
        citation,
        error: `LLM Judge rejected: score ${llmVerdict.score}/5 — ${reason}`,
        judgeVerdict: verdict,
        llmJudgeVerdict: llmVerdict,
        attempts: [...previousAttempts, attempt],
      };
    }

    const attempt = buildAttempt({
      previousAttempts,
      validatorVerdict: verdict,
      llmJudgeVerdict: llmVerdict,
      responseLength: response.length,
      latencyMs,
      outcome: 'pass',
      outcomeDetail: `Judge ${llmVerdict.score}/5`,
    });
    console.log(
      `[runMethod ${method}] return path=pass attempts.length=${previousAttempts.length + 1} prev=${previousAttempts.length}`,
    );
    return {
      method,
      prompt,
      response,
      reasoningContent,
      tokens,
      reasoningTokens,
      answerTokens,
      latencyMs,
      citation,
      judgeVerdict: verdict,
      llmJudgeVerdict: llmVerdict,
      attempts: [...previousAttempts, attempt],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attemptsOut = previousAttempts.length > 0 ? previousAttempts : undefined;
    console.log(
      `[runMethod ${method}] return path=throw attempts.length=${attemptsOut?.length ?? 'undefined'} prev=${previousAttempts.length} err="${message}"`,
    );
    return {
      method,
      prompt,
      response: '',
      reasoningContent: '',
      tokens: { input: 0, output: 0, total: 0 },
      reasoningTokens: 0,
      answerTokens: 0,
      latencyMs: 0,
      citation,
      error: message,
      attempts: attemptsOut,
    };
  }
}

async function runMethodAsManual(
  method: Method,
  question: string,
  previousAttempts: AttemptRecord[] = [],
): Promise<MethodResult> {
  const prompt = buildMethodPrompt(method, question);
  const result = await runMethod(
    method,
    question,
    prompt,
    methodCitation(method),
    previousAttempts,
  );
  return { ...result, mode: 'manual' };
}

export function runDirect(
  question: string,
  previousAttempts: AttemptRecord[] = [],
): Promise<MethodResult> {
  return runMethodAsManual('direct', question, previousAttempts);
}

export function runCoT(
  question: string,
  previousAttempts: AttemptRecord[] = [],
): Promise<MethodResult> {
  return runMethodAsManual('cot', question, previousAttempts);
}

export function runPaS(
  question: string,
  previousAttempts: AttemptRecord[] = [],
): Promise<MethodResult> {
  return runMethodAsManual('pas', question, previousAttempts);
}

export function runMethodById(
  method: Method,
  question: string,
  previousAttempts: AttemptRecord[] = [],
): Promise<MethodResult> {
  return runMethodAsManual(method, question, previousAttempts);
}
