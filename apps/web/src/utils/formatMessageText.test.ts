import { describe, expect, it } from 'vitest';
import { parseFormattedSegments } from './formatMessageText';

describe('parseFormattedSegments', () => {
  it('parses bold, italic, strikethrough, and inline code alongside plain text', () => {
    const result = parseFormattedSegments('Halo **budi**, cek *catatan* ~lama~ atau `npm run dev`.');
    expect(result).toEqual([
      { type: 'text', value: 'Halo ' },
      { type: 'bold', value: 'budi' },
      { type: 'text', value: ', cek ' },
      { type: 'italic', value: 'catatan' },
      { type: 'text', value: ' ' },
      { type: 'strike', value: 'lama' },
      { type: 'text', value: ' atau ' },
      { type: 'code', value: 'npm run dev' },
      { type: 'text', value: '.' },
    ]);
  });

  it('leaves unmatched delimiters and plain text intact', () => {
    const result = parseFormattedSegments('Harga *promo mulai 50k dan <script>alert(1)</script>');
    expect(result).toEqual([
      { type: 'text', value: 'Harga *promo mulai 50k dan <script>alert(1)</script>' },
    ]);
  });
});

