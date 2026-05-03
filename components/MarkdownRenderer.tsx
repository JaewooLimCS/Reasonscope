'use client';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

function escapePriceDollars(s: string): string {
  // Escape $ followed by a digit (e.g. $12, $1,500, $7.50) so remark-math
  // doesn't treat consecutive prices as inline-math delimiters and swallow
  // table cells / bold markers between them.
  return s.replace(/\$(?=\d)/g, '\\$');
}

function normalizeMathDelimiters(s: string): string {
  // Nemotron emits LaTeX-standard \[ ... \] (display) and \( ... \) (inline) delimiters.
  // remark-math only recognizes $ ... $ / $$ ... $$, so convert.
  return s
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => `$$${inner}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) => `$${inner}$`);
}

export function MarkdownRenderer({ content }: { content: string }) {
  const processed = normalizeMathDelimiters(escapePriceDollars(content));
  return (
    <div className="prose prose-sm min-w-0 max-w-full overflow-x-auto prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
