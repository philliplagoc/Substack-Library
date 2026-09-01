import { describe, test, expect } from 'vitest';
import { toBackup, fromBackup } from './backup';
import { makeCard } from '../test-support/factory';

describe('toBackup', () => {
  test('wraps the cards with a version and a timestamp', () => {
    const cards = [makeCard({ id: 'a' })];
    expect(toBackup(cards, '2026-08-26T12:00:00.000Z')).toEqual({
      version: 1,
      exportedAt: '2026-08-26T12:00:00.000Z',
      cards,
    });
  });
});

describe('fromBackup', () => {
  test('round-trips what toBackup produced', () => {
    const cards = [makeCard({ id: 'a' }), makeCard({ id: 'b' })];
    const raw = JSON.stringify(toBackup(cards, '2026-08-26T12:00:00.000Z'));
    const result = fromBackup(raw);
    expect(result.errors).toEqual([]);
    expect(result.cards).toEqual(cards);
  });

  test('keeps the good records and reports the bad ones by index', () => {
    const good = makeCard({ id: 'a' });
    const raw = JSON.stringify({
      version: 1,
      exportedAt: '2026-08-26T12:00:00.000Z',
      cards: [good, { id: 'b' }, { nonsense: true }],
    });

    const result = fromBackup(raw);
    expect(result.cards).toEqual([good]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('1');
    expect(result.errors[1]).toContain('2');
  });

  test('reports an unreadable file and returns no cards', () => {
    const result = fromBackup('{ not json');
    expect(result.cards).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  test('reports a file with no cards array', () => {
    const result = fromBackup(JSON.stringify({ version: 1 }));
    expect(result.cards).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  test('reports an unknown file version', () => {
    const result = fromBackup(JSON.stringify({ version: 99, cards: [] }));
    expect(result.cards).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  test('rejects a record with an unknown status', () => {
    const bad = { ...makeCard({ id: 'a' }), status: 'archived' };
    const result = fromBackup(JSON.stringify({ version: 1, cards: [bad] }));
    expect(result.cards).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  test('rejects a record whose quotes are not an array', () => {
    const bad = { ...makeCard({ id: 'a' }), quotes: 'nope' };
    const result = fromBackup(JSON.stringify({ version: 1, cards: [bad] }));
    expect(result.cards).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  test('never throws on hostile input', () => {
    for (const raw of ['', 'null', '[]', '"a string"', '{"cards": null}']) {
      expect(() => fromBackup(raw)).not.toThrow();
    }
  });

  test('accepts a card carrying a medium, and one without', () => {
    const withMedium = { ...makeCard({ id: 'm1' }), medium: 'watch' as const };
    const withoutMedium = makeCard({ id: 'm2' });
    const raw = JSON.stringify(toBackup([withMedium, withoutMedium], '2026-09-01T00:00:00.000Z'));
    const result = fromBackup(raw);
    expect(result.errors).toEqual([]);
    expect(result.cards).toHaveLength(2);
  });
});