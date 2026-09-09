import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { nanoid } from 'nanoid';
import { browser } from 'wxt/browser';
import { addQuote, cardByArticleKey } from '../db/cards';
import { createQuote } from '../domain/quote';
import {
  PANEL_STATE_KEY,
  type CaptureSelectionReply,
  type PanelMessage,
  type PanelState,
} from '../messages';
import CardEditor from './CardEditor';
import ExportButton from './ExportButton';
import { ArrowRightIcon, CheckIcon, PlusIcon } from './icons';

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

/**
 * Two outcomes are good news and one is not, and the banner should say which
 * before the reader has read a word of it.
 */
const OUTCOME_TONE: Record<PanelState['outcome'], 'ok' | 'warn'> = {
  added: 'ok',
  updated: 'ok',
  rejected: 'warn',
};

/** The panel's frame. Every state wears it, so an empty panel still looks made. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="reading">
      <div className="reading-body">{children}</div>
    </div>
  );
}

export default function ReadingPanel() {
  const panel = usePanelState();
  const card = useLiveQuery(
    () => (panel ? cardByArticleKey(panel.articleKey) : Promise.resolve(undefined)),
    [panel?.articleKey],
  );
  const [captureError, setCaptureError] = useState<string | null>(null);

  if (panel === undefined) {
    return (
      <Shell>
        <p className="empty">Loading…</p>
      </Shell>
    );
  }

  if (panel === null) {
    return (
      <Shell>
        <p className="empty">
          Open a Substack article and click the Substack Library toolbar button.
        </p>
      </Shell>
    );
  }

  if (!card) {
    return (
      <Shell>
        <p className="banner warn">{OUTCOME_TEXT[panel.outcome]}</p>
        {panel.notices.map((n) => (
          <p className="banner warn" key={n}>
            {n}
          </p>
        ))}
      </Shell>
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
      createQuote({ text: reply.text }, { id: nanoid(), capturedAt: new Date().toISOString() }),
    );
  }

  return (
    <div className="reading">
      <div className="reading-body">
        <p className={`banner ${OUTCOME_TONE[panel.outcome]}`}>
          {OUTCOME_TONE[panel.outcome] === 'ok' ? <CheckIcon className="section-icon" /> : null}
          <span>{OUTCOME_TEXT[panel.outcome]}</span>
        </p>
        {panel.notices.map((n) => (
          <p className="banner warn" key={n}>
            {n}
          </p>
        ))}

        <CardEditor
          card={card}
          quotesAction={
            /*
             * Capture and the message it may return, together. The button moved
             * from the footer into the Quotes heading, and an error about a
             * failed capture belongs where the reader just clicked, not at the
             * far end of a scrolling panel.
             */
            <span className="capture">
              <button className="capture-quote" onClick={() => void captureQuote()}>
                <PlusIcon className="section-icon" />
                <span>Capture</span>
              </button>
              {captureError ? <span className="notice error">{captureError}</span> : null}
            </span>
          }
        />
      </div>

      <footer className="reading-footer">
        <div className="footer-actions">
          <ExportButton key={card.id} card={card} />
          <button
            className="open-board"
            onClick={() =>
              void browser.runtime.sendMessage({ type: 'open-board' } satisfies PanelMessage)
            }
          >
            <span>Open the board</span>
            <ArrowRightIcon className="section-icon" />
          </button>
        </div>
      </footer>
    </div>
  );
}
