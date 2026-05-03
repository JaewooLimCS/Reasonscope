export interface JudgeVerdict {
  passed: boolean;
  failureMode?: 'empty' | 'repetition' | 'truncation';
  detail: string;
}

export function judge(response: string): JudgeVerdict {
  const trimmed = response.trim();

  // Empty: nothing rendered.
  if (trimmed.length === 0) {
    return { passed: false, failureMode: 'empty', detail: 'Response is empty' };
  }

  // Repetition: split on sentence/line/cell separators, count substantial sentences.
  const sentences = response
    .split(/[.\n|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);
  const counts = new Map<string, number>();
  for (const s of sentences) {
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let topSentence = '';
  let topCount = 0;
  for (const [s, c] of counts) {
    if (c > topCount) {
      topCount = c;
      topSentence = s;
    }
  }
  if (topCount >= 5) {
    const preview = topSentence.slice(0, 60);
    return {
      passed: false,
      failureMode: 'repetition',
      detail: `Phrase "${preview}" repeats ${topCount} times`,
    };
  }

  // Truncation: long-ish response, no sentence terminator at the end, no period in tail.
  if (trimmed.length > 100) {
    const last = trimmed[trimmed.length - 1];
    const tail = trimmed.slice(-50);
    if (!/[.!?)`}]/.test(last) && !tail.includes('.')) {
      return {
        passed: false,
        failureMode: 'truncation',
        detail: 'Response appears truncated mid-sentence',
      };
    }
  }

  return { passed: true, detail: 'OK' };
}
