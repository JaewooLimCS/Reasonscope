import { runCoT, runDirect, runPaS } from '@/lib/methods';
import { runWithSelfCorrection } from '@/lib/agenticLoop';
import type { MethodResult } from '@/types/reasoning';

export const runtime = 'nodejs';

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
    const autoCorrect = obj.autoCorrect === true;

    if (typeof question !== 'string' || question.trim().length === 0) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }

    const results: MethodResult[] = autoCorrect
      ? await Promise.all([
          runWithSelfCorrection('direct', question),
          runWithSelfCorrection('cot', question),
          runWithSelfCorrection('pas', question),
        ])
      : await Promise.all([runDirect(question), runCoT(question), runPaS(question)]);

    for (const r of results) {
      console.log(
        `[fresh ${autoCorrect ? 'agentic' : 'manual'}] ${r.method} attempts.length=${r.attempts?.length ?? 'undefined'} error=${r.error ? JSON.stringify(r.error.slice(0, 80)) : 'none'}`,
      );
    }

    return Response.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
