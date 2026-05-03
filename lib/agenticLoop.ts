import {
  buildMethodPrompt,
  methodCitation,
  methodTrigger,
  runMethod,
} from './methods';
import type { AttemptRecord, Method, MethodResult } from '@/types/reasoning';

export interface SelfCorrectionOptions {
  maxIterations?: number;
  previousAttempts?: AttemptRecord[];
}

const DEFAULT_MAX_ITERATIONS = 3;

function reasonFromResult(r: MethodResult): string {
  if (r.judgeVerdict && !r.judgeVerdict.passed) {
    return `${r.judgeVerdict.failureMode}: ${r.judgeVerdict.detail}`;
  }
  const j = r.llmJudgeVerdict;
  if (j && !j.passed) {
    if (j.completeness === 'FAIL') return j.completenessReason;
    if (j.coherence === 'FAIL') return j.coherenceReason;
    if (j.constraints === 'FAIL') return j.constraintsReason;
  }
  return 'unspecified failure';
}

function correctionPrompt(
  question: string,
  previousAnswer: string,
  reason: string,
  trigger: string,
): string {
  const lines = [
    'Original task:',
    question,
    '',
    'Your previous answer:',
    previousAnswer,
    '',
    'This answer was rejected by an automated validator. The specific issue is:',
    `"${reason}"`,
    '',
    'Please produce a corrected answer that fixes ONLY this issue while preserving everything else that was correct.',
  ];
  if (trigger) lines.push(trigger);
  return lines.join('\n');
}

function isCorrectableFailure(r: MethodResult): boolean {
  if (r.judgeVerdict && !r.judgeVerdict.passed) return true;
  if (r.llmJudgeVerdict && !r.llmJudgeVerdict.passed) return true;
  return false;
}

export async function runWithSelfCorrection(
  method: Method,
  originalQuestion: string,
  options: SelfCorrectionOptions = {},
): Promise<MethodResult> {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const trigger = methodTrigger(method);
  const citation = methodCitation(method);
  let attempts: AttemptRecord[] = options.previousAttempts ?? [];

  let lastResult: MethodResult | null = null;
  for (let iter = 1; iter <= maxIterations; iter++) {
    const prompt =
      iter === 1 && attempts.length === 0
        ? buildMethodPrompt(method, originalQuestion)
        : correctionPrompt(
            originalQuestion,
            // Most recent answer: prefer last attempt's response (carried via lastResult)
            lastResult?.response ?? '',
            lastResult ? reasonFromResult(lastResult) : 'previous attempt missing',
            trigger,
          );

    const result = await runMethod(method, originalQuestion, prompt, citation, attempts);
    attempts = result.attempts ?? attempts;
    lastResult = result;

    if (!result.error) break; // pass
    if (!isCorrectableFailure(result)) break; // hard error: nothing to correct
  }

  // lastResult is non-null here because the loop runs at least once.
  return { ...(lastResult as MethodResult), mode: 'agentic' };
}

export async function runOneCorrectionStep(
  method: Method,
  originalQuestion: string,
  previousResult: MethodResult,
): Promise<MethodResult> {
  const trigger = methodTrigger(method);
  const citation = methodCitation(method);
  const reason = reasonFromResult(previousResult);
  const prompt = correctionPrompt(
    originalQuestion,
    previousResult.response,
    reason,
    trigger,
  );
  const result = await runMethod(
    method,
    originalQuestion,
    prompt,
    citation,
    previousResult.attempts ?? [],
  );
  return { ...result, mode: 'agentic' };
}
