import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { browser } from 'wxt/browser';
import { addQuote, cardByArticleKey, moveCardTo, updateQuote } from '../db/cards';
import { createQuote, resolveQuote } from '../domain/quote';
import {
  PANEL_STATE_KEY,
  type CaptureSelectionReply,
  type PanelMessage,
  type PanelState,
} from '../messages';
import CardEditor from './CardEditor';
import ExportButton from './ExportButton';
import type { Status } from '../domain/types';

const COLUMN_LABELS: Record<Status, string> = {
  to_read: 'To Read',
  reading: 'Reading',
  processed: 'Processed',
};

/**
 * Follow the state the background writes on each toolbar click.
 *
 * Deliberately NOT tab focus. Switching to another article tab without
 * clicking leaves the panel where it was. The panel follows an action the
 * reader took, not one the browser took.
 */
function usePanelState(): PanelState | null | undefined {
  const [state, setState] = useState<PanelState | null | undefined>(undefined);

  useEffect(() => {
    let live = true;

    void browser.storage.session.get(PANEL_STATE_KEY).then((stored) => {
      if (live) setState((stored[PANEL_STATE_KEY] as PanelState | undefined) ?? null);
    });

    // The per-area `storage.session.onChanged` is newer than the generic
    // listener and not everywhere. Filter the generic one instead.
    const onChanged = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== 'session' || !(PANEL_STATE_KEY in changes)) return;
      setState((changes[PANEL_STATE_KEY]?.newValue as PanelState | undefined) ?? null);
    };

    browser.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return state;
}

const OUTCOME_TEXT: Record<PanelState['outcome'], string> = {
  added: 'Added to To Read.',
  updated: 'Already on your board. Metadata refreshed.',
  rejected: "Couldn't read this page as a Substack article.",
};

export default function ReadingPanel() {
  const panel = usePanelState();
  const card = useLiveQuery(
    () => (panel ? cardByArticleKey(panel.articleKey) : Promise.resolve(undefined)),
    [panel?.articleKey],
  );
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Re-check every quote against the article as it stands now. Persisted
  // rather than derived, because the BOARD has no article text: if this flag
  // were computed on render, the board's detail panel could never show the
  // "location unavailable" label it already renders.
  //
  // This hook sits ABOVE the early returns below, not beside the handlers. The
  // plan put it after `moveTo`, which is past three conditional returns, and a
  // hook that runs on some renders and not others is the "rendered fewer hooks
  // than expected" crash.
  useEffect(() => {
    if (!card || !panel?.bodyText) return;

    card.quotes.forEach((quote, i) => {
      const lost = resolveQuote(panel.bodyText, quote) === null;
      if (lost !== quote.locatorLost) {
        void updateQuote(card.id, i, { locatorLost: lost });
      }
    });
  }, [card?.id, card?.quotes.length, panel?.bodyText]);

  if (panel === undefined) return <p className="notice">Loading…</p>;

  if (panel === null) {
    return (
      <p className="notice">
        Open a Substack article and click the Substack Library toolbar button.
      </p>
    );
  }

  if (!card) {
    return (
      <div className="reading">
        <p className="notice error">{OUTCOME_TEXT[panel.outcome]}</p>
        {panel.notices.map((n) => (
          <p className="notice" key={n}>
            {n}
          </p>
        ))}
      </div>
    );
  }

  async function captureQuote() {
    if (!card) return;
    setCaptureError(null);

    const reply: CaptureSelectionReply = await browser.runtime.sendMessage({
      type: 'capture-selection',
    } satisfies PanelMessage);

    if (!reply.ok) {
      setCaptureError(reply.reason);
      return;
    }

    await addQuote(
      card.id,
      createQuote(
        { text: reply.text, prefix: reply.prefix },
        { capturedAt: new Date().toISOString() },
      ),
    );
  }

  return (
    <div className="reading">
      <p className="notice">{OUTCOME_TEXT[panel.outcome]}</p>
      {panel.notices.map((n) => (
        <p className="notice" key={n}>
          {n}
        </p>
      ))}

      <CardEditor
        card={card}
        footer={
          <>
            <p>
              <button onClick={() => void captureQuote()}>Capture quote</button>{' '}
              <button
                onClick={() =>
                  void browser.runtime.sendMessage({ type: 'open-board' } satisfies PanelMessage)
                }
              >
                Open the board
              </button>
            </p>
            {captureError ? <p className="notice error">{captureError}</p> : null}

            <ExportButton key={card.id} card={card} />

            <p className="statuses">
              {(Object.keys(COLUMN_LABELS) as Status[]).map((status) => (
                <button
                  key={status}
                  disabled={card.status === status}
                  onClick={() => void moveCardTo(card.id, status, new Date().toISOString())}
                >
                  {COLUMN_LABELS[status]}
                </button>
              ))}
            </p>
          </>
        }
      />
    </div>
  );
}
