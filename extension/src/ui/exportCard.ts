import { getCard, recordExport } from '../db/cards';
import { exportFilename, toMarkdown } from '../domain/markdown';
import type { Card } from '../domain/types';

export type ExportOutcome =
  | { kind: 'ok'; filename: string }
  | { kind: 'not-recorded'; filename: string; reason: string }
  | { kind: 'failed'; reason: string };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Write a card to a Markdown file the reader's browser downloads.
 *
 * The file is written FIRST and the export recorded second, deliberately. A
 * counter bumped ahead of a failed download would leave a version number for a
 * file that does not exist. In this order the worst case is the opposite: the
 * file lands, the counter stays put, and the next export generates the same
 * name, where Chrome's own conflict handling appends " (1)". A duplicate file
 * is recoverable; a phantom version in the database is not.
 *
 * The blob-and-anchor sequence is the one BackupControls has used since
 * Milestone 1. The extension has no `downloads` permission and needs none.
 */
export async function exportCard(card: Card, now: string): Promise<ExportOutcome> {
  let filename: string;

  try {
    // Read the card as persisted. The prop comes from a live query and `notes`
    // is written on a debounce, so the rendered card can trail the last
    // keystroke by up to that delay. Fall back to the prop if the row is gone.
    const fresh = (await getCard(card.id)) ?? card;
    filename = exportFilename(fresh, fresh.exportVersion + 1);

    const blob = new Blob([toMarkdown(fresh)], { type: 'text/markdown' });
    const href = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
  } catch (error) {
    return { kind: 'failed', reason: describe(error) };
  }

  try {
    await recordExport(card.id, now);
  } catch (error) {
    return { kind: 'not-recorded', filename, reason: describe(error) };
  }

  return { kind: 'ok', filename };
}
