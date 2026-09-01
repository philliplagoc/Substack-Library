/**
 * A Saved-list run, applied to the board.
 *
 * The board owns status. This module only pulls entries in; it never pushes a
 * status out, never moves a card, and never deletes one.
 */
import { db } from './schema';
import { ingestCard } from './cards';
import { savedEntryToInput, type SavedEntry } from '../domain/saved';
import type { Card } from '../domain/types';

export interface SyncReport {
  ranAt: string;
  /** False when the scroll stopped on its cap. No warnings are written then. */
  complete: boolean;
  entriesSeen: number;
  added: number;
  refreshed: number;
  /** Always 0 when `complete` is false. */
  warned: number;
  /** Entries ingestCard refused, e.g. an unparseable url. */
  rejected: number;
  /** Set when the run could not be trusted. */
  problem?: string;
}

export async function applySync(
  entries: SavedEntry[],
  ranAt: string,
  complete: boolean,
): Promise<SyncReport> {
  const report: SyncReport = {
    ranAt,
    complete,
    entriesSeen: entries.length,
    added: 0,
    refreshed: 0,
    warned: 0,
    rejected: 0,
  };

  // Zero entries is not an empty Saved list. It is a page that could not be
  // read, and the two are indistinguishable from here. Write nothing.
  if (entries.length === 0) {
    return {
      ...report,
      problem: "Read the Saved list but found no entries. Substack's layout may have changed.",
    };
  }

  // One transaction for the run. ingestCard opens its own of a compatible
  // scope, and Dexie joins it to this one rather than starting a second.
  await db.transaction('rw', db.cards, async () => {
    for (const entry of entries) {
      const { input, medium } = savedEntryToInput(entry);
      const outcome = await ingestCard(input);

      if (outcome.kind === 'rejected') {
        report.rejected += 1;
        continue;
      }

      if (outcome.kind === 'added') report.added += 1;
      else report.refreshed += 1;

      // put rather than update, because clearing an optional field is what
      // "seen again" means and put replaces the whole record.
      const seen: Card = {
        ...outcome.card,
        lastSeenInSaved: ranAt,
        medium: medium ?? outcome.card.medium,
      };
      delete seen.syncWarning;
      await db.cards.put(seen);
    }

    // Only on a run we believe is complete. A capped scroll saw a partial
    // list, and flagging its tail would be a confident wrong answer where
    // "nothing happened" is the recoverable one.
    if (complete) {
      for (const card of await db.cards.toArray()) {
        // Never in the Saved list, so it cannot have left it.
        if (!card.lastSeenInSaved) continue;
        // Seen in this run.
        if (card.lastSeenInSaved === ranAt) continue;

        await db.cards.update(card.id, {
          syncWarning: `No longer in your Substack Saved list (last seen ${card.lastSeenInSaved.slice(0, 10)})`,
        });
        report.warned += 1;
      }
    }
  });

  return report;
}
