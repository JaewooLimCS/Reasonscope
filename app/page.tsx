'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MethodCard } from '@/components/MethodCard';
import { DOMAINS } from '@/lib/domains';
import type { Method, MethodResult } from '@/types/reasoning';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [autoCorrect, setAutoCorrect] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MethodResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResults(null);
    const q = question;
    setSubmittedQuestion(q);
    try {
      const res = await fetch('/api/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, autoCorrect }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setResults(json.results as MethodResult[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(method: Method) {
    const previousResult = results?.find((r) => r.method === method);
    const previousAttempts = previousResult?.attempts ?? [];
    const mode = previousResult?.mode ?? 'manual';
    const res = await fetch('/api/reason/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: submittedQuestion,
        method,
        previousAttempts,
        mode,
        previousResult: mode === 'agentic' ? previousResult : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? `HTTP ${res.status}`);
      return;
    }
    const newResult = json.result as MethodResult;
    setResults((prev) =>
      prev ? prev.map((r) => (r.method === method ? newResult : r)) : prev,
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8 flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">ReasonScope</h1>
        <p className="text-muted-foreground mt-1">
          Multi-method reasoning observability with NVIDIA Nemotron
        </p>
      </header>

      <Separator />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">Try a domain:</span>
          {DOMAINS.map((d) => (
            <Button
              key={d.id}
              variant="outline"
              size="sm"
              onClick={() => setQuestion(d.question)}
              disabled={loading}
            >
              <span className="mr-1">{d.emoji}</span>
              {d.label}
            </Button>
          ))}
        </div>

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question, or pick a domain above..."
          rows={6}
          className="font-mono text-sm"
        />

        <div className="flex justify-between items-center">
          <label className="flex items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              checked={autoCorrect}
              onChange={(e) => setAutoCorrect(e.target.checked)}
              disabled={loading}
              className="size-4"
            />
            <span>Auto-correct (agentic loop, max 3 iterations)</span>
          </label>
          <Button
            onClick={handleRun}
            disabled={loading || question.trim().length === 0}
          >
            {loading ? 'Reasoning...' : 'Run'}
          </Button>
        </div>
      </section>

      {error && (
        <p className="text-destructive text-sm border border-destructive/30 rounded p-3">
          {error}
        </p>
      )}

      {loading && (
        <section className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[250px] w-full rounded-xl" />
          ))}
        </section>
      )}

      {results && (
        <section className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
          {results.map((r) => (
            <MethodCard
              key={r.method}
              result={r}
              onRetry={() => handleRetry(r.method)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
