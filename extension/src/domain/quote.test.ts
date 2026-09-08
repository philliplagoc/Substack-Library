import { describe, test, expect } from 'vitest';
import { createQuote } from './quote';

describe('createQuote', () => {
  test('is deterministic given an injected id and timestamp', () => {
    expect(
      createQuote({ text: 'the quoted sentence' }, { id: 'q1', capturedAt: '2026-08-29T10:00:00.000Z' }),
    ).toEqual({
      id: 'q1',
      text: 'the quoted sentence',
      capturedAt: '2026-08-29T10:00:00.000Z',
    });
  });
});
