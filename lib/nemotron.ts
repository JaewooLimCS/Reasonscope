import OpenAI from 'openai';
import { encode } from 'gpt-tokenizer';

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL_ID = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) {
  throw new Error(
    'NVIDIA_API_KEY is not set. Copy .env.local.example to .env.local and fill in your NVIDIA NIM API key.',
  );
}

const client = new OpenAI({
  apiKey,
  baseURL: NVIDIA_BASE_URL,
});

export const nemotron = client;
export const NEMOTRON_MODEL_ID = MODEL_ID;

export interface NemotronCallResult {
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
}

export async function callNemotron(userPrompt: string): Promise<NemotronCallResult> {
  const start = performance.now();

  const completion = await client.chat.completions.create({
    model: MODEL_ID,
    messages: [{ role: 'user', content: userPrompt }],
    // NVIDIA's model card recommends temperature=1.0 and top_p=1.0 for reasoning tasks on this model (the 0.6/0.95 setting is for tool calling).
    temperature: 1.0,
    top_p: 1.0,
    // Increased to accommodate long reasoning traces + answers (esp. for CoT on planning-domain prompts)
    max_tokens: 8192,
  });

  const latencyMs = performance.now() - start;

  const message = completion.choices[0]?.message as any;
  const response: string = message?.content ?? '';
  const reasoningContent: string = message?.reasoning_content ?? message?.reasoning ?? '';

  const usage = completion.usage as any;
  const outputTokens: number = usage?.completion_tokens ?? 0;
  const reasoningTokensFromAPI: number | undefined =
    usage?.completion_tokens_details?.reasoning_tokens;
  // gpt-tokenizer (cl100k_base) is a close approximation for Nemotron's Qwen-based tokenizer; sufficient for relative comparisons across methods
  const reasoningTokens =
    typeof reasoningTokensFromAPI === 'number'
      ? reasoningTokensFromAPI
      : encode(reasoningContent).length;
  const answerTokens = Math.max(0, outputTokens - reasoningTokens);

  return {
    response,
    reasoningContent,
    tokens: {
      input: usage?.prompt_tokens ?? 0,
      output: outputTokens,
      total: usage?.total_tokens ?? 0,
    },
    reasoningTokens,
    answerTokens,
    latencyMs,
  };
}
