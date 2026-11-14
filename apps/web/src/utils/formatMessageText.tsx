import { Fragment, type ReactNode } from 'react';

export type FormattedSegment =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'strike'; value: string }
  | { type: 'code'; value: string };

const INLINE_TOKEN_RE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|~[^~\n]+~)/g;

/**
 * Splits message text into inline formatting segments without evaluating HTML.
 */
export function parseFormattedSegments(input: string): FormattedSegment[] {
  if (!input) return [];

  const segments: FormattedSegment[] = [];
  let cursor = 0;

  for (const match of input.matchAll(INLINE_TOKEN_RE)) {
    const idx = match.index ?? 0;
    const raw = match[0];

    if (idx > cursor) {
      segments.push({ type: 'text', value: input.slice(cursor, idx) });
    }

    if (raw.startsWith('`') && raw.endsWith('`') && raw.length >= 2) {
      segments.push({ type: 'code', value: raw.slice(1, -1) });
    } else if (raw.startsWith('**') && raw.endsWith('**') && raw.length >= 4) {
      segments.push({ type: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('*') && raw.endsWith('*') && raw.length >= 2) {
      segments.push({ type: 'italic', value: raw.slice(1, -1) });
    } else if (raw.startsWith('~') && raw.endsWith('~') && raw.length >= 2) {
      segments.push({ type: 'strike', value: raw.slice(1, -1) });
    } else {
      segments.push({ type: 'text', value: raw });
    }

    cursor = idx + raw.length;
  }

  if (cursor < input.length) {
    segments.push({ type: 'text', value: input.slice(cursor) });
  }

  return segments;
}

/**
 * Renders safe inline markdown (**bold**, *italic*, ~strike~, `code`) as React elements.
 */
export function formatMessageText(input: string): ReactNode {
  const segments = parseFormattedSegments(input);
  return segments.map((seg, index) => {
    switch (seg.type) {
      case 'code':
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 rounded bg-black/20 font-mono-code text-[0.88em]"
          >
            {seg.value}
          </code>
        );
      case 'bold':
        return (
          <strong key={index} className="font-semibold">
            {seg.value}
          </strong>
        );
      case 'italic':
        return (
          <em key={index} className="italic">
            {seg.value}
          </em>
        );
      case 'strike':
        return (
          <del key={index} className="line-through opacity-80">
            {seg.value}
          </del>
        );
      default:
        return <Fragment key={index}>{seg.value}</Fragment>;
    }
  });
}

