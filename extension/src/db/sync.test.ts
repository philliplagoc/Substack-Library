import { describe, test, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { allCards } from './cards';
import { applySync } from './sync';
import { makeCard } from '../test-support/factory';
import type { Card } from '../domain/types';
import type { SavedEntry } from '../domain/saved';

const RAN_AT = '2026-09-01T10:00:00.000Z';
const EARLIER = '2026-08-20T10:00:00.000Z';

function entry(overrides: Partial<SavedEntry> = {}): SavedEntry {
  return {
    url: 'https://alpha.substack.com/p/one',
    title: 'One',
    publication: 'Alpha Notes',
    itemMeta: 'A. Writer∙7 min read',
    ...overrides,
  };
}

async function cardByTitle(title: string): Promise<Card> {
  const cards = await allCards();
  const found = cards.find((c) => c.title === title);
  expect(found).toBeDefined();
  return found!;
}

beforeEach(async () => {
  await db.cards.clear();
});

describe('applySync imports', () => {
  test('adds a new entry to To Read with its metadata', async () => {
    const report = await applySync([entry()], RAN_AT, true);

    expect(report.added).toBe(1);
    expect(report.refreshed).toBe(0);
    const card = await cardByTitle('One');
    expect(card.status).toBe('to_read');
    expect(card.author).toBe('A. Writer');
    expect(card.publication).toBe('Alpha Notes');
    expect(card.estimatedReadingMinutes).toBe(7);
    expect(card.lastSeenInSaved).toBe(RAN_AT);
  });

  test('records the medium on a watch entry', async () => {
    await applySync([entry({ title: 'Pod', itemMeta: 'A. Host∙1 hr 6 min watch' })], RAN_AT, true);

    const card = await cardByTitle('Pod');
    expect(card.medium).toBe('watch');
    expect(card.estimatedReadingMinutes).toBe(66);
  });

  test('refreshes a known entry and keeps its notes and quotes', async () => {
    await db.cards.add(
      makeCard({
        id: 'known',
        url: 'https://alpha.substack.com/p/one',
        title: 'Stale title',
        notes: 'my notes',
        quotes: [{ text: 'a quote', locatorLost: false, capturedAt: EARLIER }],
      }),
    );

    const report = await applySync([entry()], RAN_AT, true);

    expect(report.added).toBe(0);
    expect(report.refreshed).toBe(1);
    const card = await cardByTitle('One');
    expect(card.id).toBe('known');
    expect(card.notes).toBe('my notes');
    expect(card.quotes).toHaveLength(1);
  });

  // The inbox model, and the whole reason mergeCard was reused rather than
  // written again: an article the reader has finished is finished.
  test('never resurrects a Processed card', async () => {
    await db.cards.add(
      makeCard({
        id: 'done',
        url: 'https://alpha.substack.com/p/one',
        status: 'processed',
      }),
    );

    await applySync([entry()], RAN_AT, true);

    const card = await cardByTitle('One');
    expect(card.status).toBe('processed');
  });

  test('counts an entry ingestCard refuses rather than throwing', async () => {
    const report = await applySync([entry({ url: 'not-a-url' })], RAN_AT, true);

    expect(report.rejected).toBe(1);
    expect(report.added).toBe(0);
    expect(await allCards()).toHaveLength(0);
  });
});

describe('applySync flags what has left the list', () => {
  test('warns about a card seen in an earlier run and absent now', async () => {
    await db.cards.add(
      makeCard({
        id: 'gone',
        url: 'https://alpha.substack.com/p/gone',
        title: 'Gone',
        lastSeenInSaved: EARLIER,
      }),
    );

    const report = await applySync([entry()], RAN_AT, true);

    expect(report.warned).toBe(1);
    const card = await cardByTitle('Gone');
    expect(card.syncWarning).toContain('No longer in your Substack Saved list');
    // Noted, not moved and not deleted.
    expect(card.status).toBe('to_read');
  });

  // The warning means "this left your Saved list", not "this is not in it".
  test('never warns about a card that was never in the Saved list', async () => {
    await db.cards.add(
      makeCard({ id: 'by-hand', url: 'https://alpha.substack.com/p/by-hand', title: 'By hand' }),
    );

    const report = await applySync([entry()], RAN_AT, true);

    expect(report.warned).toBe(0);
    expect((await cardByTitle('By hand')).syncWarning).toBeUndefined();
  });

  test('clears the warning when the article comes back', async () => {
    await db.cards.add(
      makeCard({
        id: 'back',
        url: 'https://alpha.substack.com/p/one',
        lastSeenInSaved: EARLIER,
        syncWarning: 'No longer in your Substack Saved list (last seen 2026-08-20)',
      }),
    );

    await applySync([entry()], RAN_AT, true);

    const card = await cardByTitle('One');
    expect(card.syncWarning).toBeUndefined();
    expect(card.lastSeenInSaved).toBe(RAN_AT);
  });

});

describe('applySync protects the board from a bad run', () => {
  // The rule the whole design rests on. Without it, one renamed Substack class
  // writes a warning onto every card on the board.
  test('writes no warnings when the scroll did not finish', async () => {
    await db.cards.add(
      makeCard({ id: 'gone', url: 'https://alpha.substack.com/p/gone', title: 'Gone', lastSeenInSaved: EARLIER }),
    );

    const report = await applySync([entry()], RAN_AT, false);

    expect(report.warned).toBe(0);
    expect(report.complete).toBe(false);
    expect((await cardByTitle('Gone')).syncWarning).toBeUndefined();
    // Imports still happen. A partial list is still real entries.
    expect(report.added).toBe(1);
  });

  test('writes nothing at all when no entries were parsed', async () => {
    await db.cards.add(
      makeCard({ id: 'gone', url: 'https://alpha.substack.com/p/gone', title: 'Gone', lastSeenInSaved: EARLIER }),
    );

    const report = await applySync([], RAN_AT, true);

    expect(report.warned).toBe(0);
    expect(report.added).toBe(0);
    expect(report.problem).toContain('layout may have changed');
    expect((await cardByTitle('Gone')).syncWarning).toBeUndefined();
    expect((await cardByTitle('Gone')).lastSeenInSaved).toBe(EARLIER);
  });
});
