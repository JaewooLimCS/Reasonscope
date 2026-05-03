import { runCoT, runDirect, runPaS } from '@/lib/methods';
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

    const question =
      typeof body === 'object' && body !== null && 'question' in body
        ? (body as { question: unknown }).question
        : undefined;

    if (typeof question !== 'string' || question.trim().length === 0) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }

    const results: MethodResult[] = await Promise.all([
      runDirect(question),
      runCoT(question),
      runPaS(question),
    ]);

    for (const r of results) {
      console.log(
        `[fresh] ${r.method} returning attempts.length = ${r.attempts?.length ?? 'undefined'} error=${r.error ? JSON.stringify(r.error.slice(0, 80)) : 'none'}`,
      );
    }

    return Response.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
