import { useState } from 'react';
import { exportCard, type ExportOutcome } from './exportCard';
import { UploadIcon } from './icons';
import type { Card } from '../domain/types';

interface Props {
  card: Card;
}

/**
 * Export the card and say what happened.
 *
 * It used to offer a move to Processed after a successful export. That offer
 * went on 2026-09-03, along with the reading panel's status row: a card moves
 * column when the reader drags it on the board and at no other time. Exporting
 * mid-read to check the format is not a claim that the article is finished, and
 * inferring one from an export was the extension guessing.
 *
 * Mount this with key={card.id} so switching articles in the reading panel
 * clears the notice rather than showing the previous card's.
 *
 * It renders a bare button and its notices, with no heading of its own. The
 * side panel wants it as one cell of a two-button footer; the board still wants
 * a section, and supplies the heading itself.
 */
export default function ExportButton({ card }: Props) {
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    setOutcome(null);
    setOutcome(await exportCard(card, new Date().toISOString()));
    setBusy(false);
  }

  return (
    <>
      <button className="export" disabled={busy} onClick={() => void handleExport()}>
        <UploadIcon className="section-icon" />
        <span>Export Markdown</span>
      </button>

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
    </>
  );
}
