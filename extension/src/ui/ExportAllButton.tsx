import { useState } from 'react';
import { libraryFilename, toLibraryMarkdown } from '../domain/markdown';
import { downloadFile } from './downloadFile';
import type { Card } from '../domain/types';

/**
 * Every card the board is showing, as one Markdown file.
 *
 * It takes the already-filtered list rather than reading the database, so the
 * export composes with the search box, the minutes box, and the tag filter.
 *
 * It records nothing. `exportVersion` counts the notes that exist for one
 * article, which is what makes the ` (v2)` suffix mean something; counting a
 * bulk snapshot would turn the next single export of every card into a `(v2)`
 * whose v1 was never written.
 */
export default function ExportAllButton({ cards }: { cards: Card[] }) {
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  function handleClick() {
    const now = new Date().toISOString();

    try {
      downloadFile(libraryFilename(now), toLibraryMarkdown(cards, now), 'text/markdown');
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : String(error),
        error: true,
      });
      return;
    }

    setNotice({ text: `Exported ${cards.length} cards.`, error: false });
  }

  return (
    <span className="export-all">
      <button
        onClick={handleClick}
        disabled={cards.length === 0}
        title={
          cards.length === 0
            ? 'No cards to export.'
            : 'Download the cards you can see now as one Markdown file.'
        }
      >
        Export Notes
      </button>
      {notice ? (
        <span className={`notice${notice.error ? ' error' : ''}`}>{notice.text}</span>
      ) : null}
    </span>
  );
}
