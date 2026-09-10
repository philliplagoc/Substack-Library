import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { nanoid } from 'nanoid';
import { browser } from 'wxt/browser';
import { addQuote, cardByArticleKey, deleteCard, getCard } from '../db/cards';
import { createQuote } from '../domain/quote';
import {
  PANEL_STATE_KEY,
  type CaptureOutcome,
  type CaptureSelectionReply,
  type PanelMessage,
  type PanelState,
} from '../messages';
import CardEditor from './CardEditor';
import ExportButton from './ExportButton';
import { panelView } from './panelView';
import { useLiveArticle } from './useLiveArticle';
import { ArrowRightIcon, CheckIcon, PlusIcon, TrashIcon } from './icons';

/**
 * Follow the state that names the card to show.
 *
 * Two things write it: the background on a toolbar click, and the board when
 * the reader clicks a card.
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

const OUTCOME_TEXT: Record<CaptureOutcome, string> = {
  added: 'Added to To Read.',
  updated: 'Already on your board. Metadata refreshed.',
  rejected: "Couldn't read this page as a Substack article.",
};

/**
 * Two outcomes are good news and one is not, and the banner should say which
 * before the reader has read a word of it.
 */
const OUTCOME_TONE: Record<CaptureOutcome, 'ok' | 'warn'> = {
  added: 'ok',
  updated: 'ok',
  rejected: 'warn',
};

/** Shown on the Capture button when it has no page to read a selection from. */
const CAPTURE_HINT = 'Open the article in this window to capture a quote.';

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

  /*
   * `undefined` while the query runs, `null` once it has run and found
   * nothing. Dexie returns `undefined` for both, and the two mean opposite
   * things here: one is "wait", the other is "that card is gone".
   *
   * A board opening addresses the card by id, because `articleKey` is indexed
   * but not unique and `cardByArticleKey` returns the first match.
   */
  const card = useLiveQuery(() => {
    if (!panel) return Promise.resolve(undefined);
    const found =
      panel.source === 'board' ? getCard(panel.cardId) : cardByArticleKey(panel.articleKey);
    return found.then((c) => c ?? null);
  }, [panel?.source, panel?.source === 'board' ? panel.cardId : panel?.articleKey]);

  /*
   * Asked of the card, not of the panel state. The state records how the panel
   * was opened and never changes after; this asks what is in front of the
   * reader now, which is the question the Capture button actually turns on.
   */
  const live = useLiveArticle(card?.url ?? null, card?.articleKey ?? null);

  const [captureError, setCaptureError] = useState<string | null>(null);
  const view = panelView(panel, card, live);

  async function captureQuote(cardId: string, tabId: number) {
    setCaptureError(null);

    const reply: CaptureSelectionReply = await browser.runtime.sendMessage({
      type: 'capture-selection',
      tabId,
    } satisfies PanelMessage);

    if (!reply.ok) {
      setCaptureError(reply.reason);
      return;
    }

    await addQuote(
      cardId,
      createQuote({ text: reply.text }, { id: nanoid(), capturedAt: new Date().toISOString() }),
    );
  }

  /*
   * Called straight out of the click handler and never awaited past.
   * `permissions.request` needs the user gesture, the same rule that decides
   * where `sidePanel.open` may be called from.
   */
  function allowCapture(pattern: string) {
    void browser.permissions.request({ origins: [pattern] });
  }

  function openBoard() {
    void browser.runtime.sendMessage({ type: 'open-board' } satisfies PanelMessage);
  }

  if (view.kind === 'loading') {
    return (
      <Shell>
        <p className="empty">Loading…</p>
      </Shell>
    );
  }

  if (view.kind === 'prompt') {
    return (
      <Shell>
        <p className="empty">
          Open a Substack article and click the Substack Library toolbar button.
        </p>
      </Shell>
    );
  }

  if (view.kind === 'gone') {
    return (
      <Shell>
        <p className="empty">That card is no longer on your board.</p>
      </Shell>
    );
  }

  if (view.kind === 'rejected') {
    return (
      <Shell>
        <p className="banner warn">{OUTCOME_TEXT[view.outcome]}</p>
        {view.notices.map((n) => (
          <p className="banner warn" key={n}>
            {n}
          </p>
        ))}
      </Shell>
    );
  }

  const { card: shown, banner, notices, capture } = view;

  async function handleDelete() {
    if (!window.confirm(`Delete "${shown.title}"? This cannot be undone.`)) return;
    await deleteCard(shown.id);
    // No close and no state to clear. The live query loses the row, the view
    // turns to 'gone', and the board's outline goes with the tile.
  }

  return (
    <div className="reading">
      <div className="reading-body">
        {banner ? (
          <p className={`banner ${OUTCOME_TONE[banner]}`}>
            {OUTCOME_TONE[banner] === 'ok' ? <CheckIcon className="section-icon" /> : null}
            <span>{OUTCOME_TEXT[banner]}</span>
          </p>
        ) : null}
        {notices.map((n) => (
          <p className="banner warn" key={n}>
            {n}
          </p>
        ))}

        <CardEditor
          card={shown}
          quotesAction={
            /*
             * Capture and the message it may return, together. The button sits
             * in the Quotes heading, and an error about a failed capture
             * belongs where the reader just clicked, not at the far end of a
             * scrolling panel.
             *
             * Disabled, not hidden, when there is no page behind it. The
             * control is part of what this panel is, and hiding it would make
             * the panel look like a different thing depending on how it was
             * opened, which is the confusion this whole change removes.
             *
             * When the article is open but unreadable, the way out sits right
             * here: one button that asks Chrome for this publication.
             */
            <span className="capture">
              <button
                className="capture-quote"
                disabled={capture.kind !== 'ready'}
                title={capture.kind === 'ready' ? undefined : CAPTURE_HINT}
                onClick={() => {
                  if (capture.kind === 'ready') void captureQuote(shown.id, capture.tabId);
                }}
              >
                <PlusIcon className="section-icon" />
                <span>Capture</span>
              </button>
              {captureError ? <span className="notice error">{captureError}</span> : null}
              {capture.kind === 'absent' ? (
                <span className="notice">Open the article first.</span>
              ) : null}
              {capture.kind === 'ask' ? (
                <button
                  className="allow-capture"
                  title={`Let Substack Library read a selection from ${capture.host}.`}
                  onClick={() => allowCapture(capture.pattern)}
                >
                  Allow on {capture.host}
                </button>
              ) : null}
            </span>
          }
        />
      </div>

      <footer className="reading-footer">
        <div className="footer-actions">
          <ExportButton key={shown.id} card={shown} />
          {/*
            * Always enabled. An open board tab is not a reason to refuse: the
            * background's `openBoard` focuses the tab it already opened and
            * only creates one when there is none, so this button always has
            * somewhere to go. Greying it out told the reader "no" for the one
            * case where the answer was "yes, and it is one click away".
            */}
          <button className="open-board" onClick={openBoard}>
            <span>Open the board</span>
            <ArrowRightIcon className="section-icon" />
          </button>
          <button className="delete-card" onClick={() => void handleDelete()}>
            <TrashIcon className="section-icon" />
            <span>Delete card</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
