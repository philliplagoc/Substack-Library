import { useState } from 'react';
import { moveCardTo } from '../db/cards';
import { exportCard, type ExportOutcome } from './exportCard';
import type { Card } from '../domain/types';

interface Props {
  card: Card;
}

/**
 * Export the card, then offer the move to Processed.
 *
 * The offer is an offer. "Not yet" restores the plain button and remembers
 * nothing: exporting mid-read to check the format must not move a card the
 * reader has not finished.
 *
 * Mount this with key={card.id} so switching articles in the reading panel
 * clears the notice and the offer rather than showing the previous card's.
 */
export default function ExportButton({ card }: Props) {
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    setMoveError(null);
    setOutcome(null);
    setOfferOpen(false);
    const result = await exportCard(card, new Date().toISOString());
    setOutcome(result);
    // Nowhere to move a card that is already there, and an offer that does
    // nothing teaches the reader to ignore offers.
    setOfferOpen(result.kind !== 'failed' && card.status !== 'processed');
    setBusy(false);
  }

  async function handleMove() {
    setMoveError(null);
    try {
      await moveCardTo(card.id, 'processed', new Date().toISOString());
      setOfferOpen(false);
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <h3>Export</h3>
      <p>
        <button disabled={busy} onClick={() => void handleExport()}>
          Export Markdown
        </button>
      </p>

      {outcome?.kind === 'ok' ? (
        <p className="notice">Exported as “{outcome.filename}”.</p>
      ) : null}

      {outcome?.kind === 'not-recorded' ? (
        <p className="notice error">
          Saved “{outcome.filename}”, but the export was not recorded on the card:{' '}
          {outcome.reason}
        </p>
      ) : null}

      {outcome?.kind === 'failed' ? (
        <p className="notice error">The file could not be saved: {outcome.reason}</p>
      ) : null}

      {offerOpen ? (
        <p className="offer">
          Move to Processed?{' '}
          <button onClick={() => void handleMove()}>Yes</button>{' '}
          <button onClick={() => setOfferOpen(false)}>Not yet</button>
        </p>
      ) : null}

      {moveError ? (
        <p className="notice error">The card could not be moved: {moveError}</p>
      ) : null}
    </>
  );
}
