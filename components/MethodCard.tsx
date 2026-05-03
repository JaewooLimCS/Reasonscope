'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { AttemptRecord, MethodResult } from '@/types/reasoning';

const METHOD_LABELS: Record<MethodResult['method'], string> = {
  direct: 'Direct',
  cot: 'Chain-of-Thought',
  pas: 'Plan-and-Solve',
};

interface MethodCardProps {
  result: MethodResult;
  onRetry?: () => Promise<void>;
}

function StatusBadge({ result }: { result: MethodResult }) {
  const validatorFail = result.judgeVerdict && !result.judgeVerdict.passed;
  const judgeFail = result.llmJudgeVerdict && !result.llmJudgeVerdict.passed;

  if (validatorFail) {
    return (
      <Badge variant="destructive" className="text-xs">
        Validator: {result.judgeVerdict?.failureMode}
      </Badge>
    );
  }
  if (judgeFail) {
    return (
      <Badge className="text-xs bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-300">
        Judge: {result.llmJudgeVerdict?.score}/5
      </Badge>
    );
  }
  if (result.llmJudgeVerdict?.passed) {
    return (
      <Badge className="text-xs bg-emerald-100 text-emerald-900 hover:bg-emerald-100 border-emerald-300">
        ✓ validated
      </Badge>
    );
  }
  return null;
}

function CriterionRow({
  label,
  status,
  reason,
}: {
  label: string;
  status: 'PASS' | 'FAIL';
  reason: string;
}) {
  return (
    <div className="text-xs">
      <span className="font-medium">{label}: </span>
      <span className={status === 'PASS' ? 'text-emerald-700' : 'text-destructive'}>
        {status}
      </span>
      {reason && <span className="text-muted-foreground"> — {reason}</span>}
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function AttemptRow({
  attempt,
  isCurrent,
  mode,
}: {
  attempt: AttemptRecord;
  isCurrent: boolean;
  mode: 'agentic' | 'manual';
}) {
  const totalSeconds = ((attempt.latencyMs + (attempt.judgeLatencyMs ?? 0)) / 1000).toFixed(0);
  const colorClass =
    attempt.outcome === 'pass'
      ? 'text-emerald-700'
      : attempt.outcome === 'validator_fail'
        ? 'text-destructive'
        : 'text-amber-700';
  const icon = attempt.outcome === 'pass' ? '✅' : '❌';
  const label = mode === 'agentic' ? 'Iteration' : 'Attempt';

  return (
    <div className="text-xs flex flex-wrap gap-x-2">
      <span className="font-medium">{label} {attempt.attemptNumber}</span>
      <span className="text-muted-foreground">· {formatTime(attempt.timestamp)}</span>
      <span className={colorClass}>
        · {icon} {attempt.outcomeDetail}
      </span>
      {isCurrent && <span className="text-muted-foreground">— current</span>}
      <span className="text-muted-foreground ml-auto">· {totalSeconds}s</span>
    </div>
  );
}

export function MethodCard({ result, onRetry }: MethodCardProps) {
  const label = METHOD_LABELS[result.method];
  const [retrying, setRetrying] = useState(false);
  const validatorFailed = result.judgeVerdict && !result.judgeVerdict.passed;
  const judgeFailed = result.llmJudgeVerdict && !result.llmJudgeVerdict.passed;
  const canRetry = Boolean(result.error && (validatorFailed || judgeFailed) && onRetry);
  const llm = result.llmJudgeVerdict;
  const attempts = Array.isArray(result.attempts) ? result.attempts : [];
  // Guard: never let arithmetic produce a negative or stale count.
  const retryCount = Math.max(0, attempts.length - 1);
  const mode: 'agentic' | 'manual' = result.mode ?? 'manual';
  const AGENTIC_MAX_ITERATIONS = 3;
  const hitMaxIterations =
    mode === 'agentic' &&
    Boolean(result.error) &&
    attempts.length >= AGENTIC_MAX_ITERATIONS;

  async function handleRetry() {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Card className="flex flex-col min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <div className="flex items-center gap-2">
            {retryCount > 0 ? (
              <Badge variant="outline" className="text-xs">
                🔄 {mode === 'agentic' ? 'Iterated' : 'Retried'} {retryCount}×
              </Badge>
            ) : null}
            <StatusBadge result={result} />
            <Badge variant="secondary" className="text-xs font-mono">
              {result.method}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1 min-w-0">
        {hitMaxIterations && (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            Max iterations reached ({AGENTIC_MAX_ITERATIONS}) — last attempt scored{' '}
            {llm?.score ?? '?'}/5. Showing the final attempt's answer below.
          </div>
        )}

        {result.error && !hitMaxIterations ? (
          <>
            <p className="text-sm text-destructive">Error: {result.error}</p>
            {judgeFailed && llm && (
              <div className="flex flex-col gap-1 rounded border p-2 bg-amber-50">
                <div className="text-xs font-medium">Score: {llm.score}/5</div>
                <CriterionRow
                  label="Completeness"
                  status={llm.completeness}
                  reason={llm.completenessReason}
                />
                <CriterionRow
                  label="Coherence"
                  status={llm.coherence}
                  reason={llm.coherenceReason}
                />
                <CriterionRow
                  label="Constraints"
                  status={llm.constraints}
                  reason={llm.constraintsReason}
                />
              </div>
            )}
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={retrying}
                className="self-start"
              >
                {retrying ? 'Retrying...' : '🔄 Retry'}
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="leading-relaxed min-w-0 max-w-full overflow-x-auto">
              <MarkdownRenderer content={result.response} />
            </div>

            <Separator />

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {result.answerTokens} answer tokens · {result.latencyMs.toFixed(0)} ms
                </span>
                <span>{result.tokens.total} total</span>
              </div>
              {llm && (
                <div className="text-xs text-muted-foreground">
                  Judge: {(llm.judgeLatencyMs / 1000).toFixed(1)}s · score {llm.score}/5
                </div>
              )}
            </div>

            {hitMaxIterations && judgeFailed && llm && (
              <div className="flex flex-col gap-1 rounded border p-2 bg-amber-50">
                <div className="text-xs font-medium">Last judge breakdown · Score: {llm.score}/5</div>
                <CriterionRow
                  label="Completeness"
                  status={llm.completeness}
                  reason={llm.completenessReason}
                />
                <CriterionRow
                  label="Coherence"
                  status={llm.coherence}
                  reason={llm.coherenceReason}
                />
                <CriterionRow
                  label="Constraints"
                  status={llm.constraints}
                  reason={llm.constraintsReason}
                />
              </div>
            )}

            {hitMaxIterations && canRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={retrying}
                className="self-start"
              >
                {retrying ? 'Retrying...' : '🔄 Run one more correction'}
              </Button>
            )}

            <Accordion>
              <AccordionItem value="trace" className="border-b-0">
                <AccordionTrigger className="text-sm py-2">
                  Reasoning trace ({result.reasoningTokens} tokens)
                </AccordionTrigger>
                <AccordionContent>
                  <div className="text-sm text-muted-foreground min-w-0 max-w-full overflow-x-auto">
                    {result.reasoningContent ? (
                      <MarkdownRenderer content={result.reasoningContent} />
                    ) : (
                      <p>No internal reasoning trace returned.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <p className="text-xs text-muted-foreground mt-auto pt-2">
              {result.citation ?? 'Baseline (no citation)'}
            </p>
          </>
        )}

        {attempts.length > 1 && (
          <Accordion>
            <AccordionItem value="history" className="border-b-0">
              <AccordionTrigger className="text-sm py-2">
                Attempt history ({attempts.length} attempts)
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-1">
                  {attempts.map((a) => (
                    <AttemptRow
                      key={a.attemptNumber}
                      attempt={a}
                      isCurrent={a.attemptNumber === attempts.length}
                      mode={mode}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
