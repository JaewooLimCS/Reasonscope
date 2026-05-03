import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '..', '.env.local') });
console.log('Loaded key:', process.env.NVIDIA_API_KEY?.slice(0, 8));

const QUESTION = 'What is 17 * 23? Show your reasoning.';

async function main() {
  // Dynamic import: must run AFTER dotenv config so lib/nemotron.ts sees the env var.
  const { nemotron, NEMOTRON_MODEL_ID } = await import('../lib/nemotron');

  console.log(`Question: ${QUESTION}`);
  console.log(`Model: ${NEMOTRON_MODEL_ID}\n`);

  const start = performance.now();
  const completion: any = await nemotron.chat.completions.create({
    model: NEMOTRON_MODEL_ID,
    messages: [{ role: 'user', content: QUESTION }],
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 4096,
  });
  const latencyMs = performance.now() - start;

  const choice = completion.choices?.[0];
  const message = choice?.message ?? {};
  const usage = completion.usage ?? {};

  const answer: string = message.content ?? '';
  const reasoning: string = message.reasoning_content ?? message.reasoning ?? '';

  console.log('=== answer (first 300 chars) ===');
  console.log(answer.slice(0, 300));
  console.log(`(answer length: ${answer.length} chars)\n`);

  console.log('=== reasoning_content (first 500 chars) ===');
  console.log(reasoning.slice(0, 500));
  console.log(`(reasoning length: ${reasoning.length} chars, populated: ${reasoning.length > 0})\n`);

  console.log('=== tokens ===');
  console.log(`prompt_tokens:     ${usage.prompt_tokens ?? 0}`);
  console.log(`completion_tokens: ${usage.completion_tokens ?? 0}`);
  console.log(`total_tokens:      ${usage.total_tokens ?? 0}`);
  console.log(
    `reasoning_tokens (from API): ${usage.completion_tokens_details?.reasoning_tokens ?? 'not present'}`,
  );
  console.log(`latency: ${latencyMs.toFixed(0)} ms\n`);

  console.log('=== full message keys ===');
  console.log(Object.keys(message));
  console.log('\n=== full usage object ===');
  console.log(JSON.stringify(usage, null, 2));

  console.log('\n=== callNemotron() computed fields (via gpt-tokenizer) ===');
  const { callNemotron } = await import('../lib/nemotron');
  const r = await callNemotron(QUESTION);
  console.log(`response length:    ${r.response.length} chars`);
  console.log(`reasoning length:   ${r.reasoningContent.length} chars`);
  console.log(`tokens.input:       ${r.tokens.input}`);
  console.log(`tokens.output:      ${r.tokens.output}`);
  console.log(`tokens.total:       ${r.tokens.total}`);
  console.log(`reasoningTokens:    ${r.reasoningTokens}  (real tokenizer; char/4 estimate would have been ${Math.round(r.reasoningContent.length / 4)})`);
  console.log(`answerTokens:       ${r.answerTokens}`);
  console.log(`latencyMs:          ${r.latencyMs.toFixed(0)} ms`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
