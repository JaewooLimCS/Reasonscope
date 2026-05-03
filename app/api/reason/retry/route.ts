import { runMethodById } from '@/lib/methods';
import { runOneCorrectionStep } from '@/lib/agenticLoop';
import type { AttemptRecord, Method, MethodResult } from '@/types/reasoning';

export const runtime = 'nodejs';

const VALID_METHODS: readonly Method[] = ['direct', 'cot', 'pas'];

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const obj = (typeof body === 'object' && body !== null ? body : {}) as Record<
      string,
      unknown
    >;
    const question = obj.question;
    const method = obj.method;
    const previousAttempts = Array.isArray(obj.previousAttempts)
      ? (obj.previousAttempts as AttemptRecord[])
      : [];
    const mode = obj.mode === 'agentic' ? 'agentic' : 'manual';
    const previousResult =
      typeof obj.previousResult === 'object' && obj.previousResult !== null
        ? (obj.previousResult as MethodResult)
        : null;

    if (typeof question !== 'string' || question.trim().length === 0) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }
    if (typeof method !== 'string' || !VALID_METHODS.includes(method as Method)) {
      return Response.json(
        { error: `method must be one of ${VALID_METHODS.join(', ')}` },
        { status: 400 },
      );
    }

    let result: MethodResult;
    if (mode === 'agentic' && previousResult) {
      // Manual click after the agentic loop hit max iterations:
      // do ONE more correction iteration based on the latest failure.
      result = await runOneCorrectionStep(method as Method, question, previousResult);
    } else {
      result = await runMethodById(method as Method, question, previousAttempts);
    }

    console.log(
      `[retry mode=${mode}] ${result.method} previousAttempts.length = ${previousAttempts.length} returning attempts.length = ${result.attempts?.length ?? 'undefined'}`,
    );
    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
