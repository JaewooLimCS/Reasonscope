import type { JudgeVerdict } from '@/lib/judge';
import type { LLMJudgeVerdict } from '@/lib/llmJudge';

export type Method = 'direct' | 'cot' | 'pas';

export interface MethodMeta {
  id: Method;
  name: string;
  citation: string | null;
}

export interface AttemptRecord {
  attemptNumber: number;
  timestamp: number;
  validatorVerdict: JudgeVerdict;
  llmJudgeVerdict?: LLMJudgeVerdict;
  responseLength: number;
  latencyMs: number;
  judgeLatencyMs?: number;
  outcome: 'pass' | 'validator_fail' | 'judge_reject';
  outcomeDetail: string;
}

export interface MethodResult {
  method: Method;
  prompt: string;
  response: string;
  reasoningContent: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  reasoningTokens: number;
  answerTokens: number;
  latencyMs: number;
  citation: string | null;
  error?: string;
  judgeVerdict?: JudgeVerdict;
  llmJudgeVerdict?: LLMJudgeVerdict;
  attempts?: AttemptRecord[];
}
