import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { nanoid } from 'nanoid';
import { browser } from 'wxt/browser';
import { addQuote, cardByArticleKey, deleteCard, getCard } from '../db/cards';
import { createQuote } from '../domain/quote';
import {
  PANEL_STATE_KEY,
  type AddArticleReply,
  type CaptureSelectionReply,
  type PanelMessage,
  type PanelState,
} from '../messages';
import type { Card } from '../domain/types';
import CardEditor from './CardEditor';
import ExportButton from './ExportButton';
import { panelView } from './panelView';
import { useActiveTabGrant } from './useActiveTabGrant';
import { useCapturePermission } from './useCapturePermission';
import { useFocusedTab } from './useFocusedTab';
import { ArrowRightIcon, CheckIcon, PlusIcon, TrashIcon } from './icons';

/**
 * Follow the board's pick.
 *
 * One writer: the board, when the reader clicks a card. It answers the one
 * question watching the focused tab cannot — which of possibly several cards
 * on the board was clicked — and matters only while the board is focused.
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

/** What adding the article did. Only the two outcomes that produce a card. */
const OUTCOME_TEXT: Record<'added' | 'updated', string> = {
  added: 'Added to To Read.',
  updated: 'Already on your board. Metadata refreshed.',
};

const OUTCOME_TONE: Record<'added' | 'updated', 'ok' | 'warn'> = {
  added: 'ok',
  updated: 'ok',
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
  const tab = useFocusedTab();
  const panel = usePanelState();

  /*
   * `undefined` while the query runs, `null` once it has run and found
   * nothing. Dexie returns `undefined` for both, and the two mean opposite
   * things here: one is "wait", the other is "there is no card".
   *
   * Which card is asked for depends on what is focused. The board addresses
   * its pick by id, because `articleKey` is indexed but not unique and
   * `cardByArticleKey` returns the first match. An article has only its key.
   */
  const card = useLiveQuery(() => {
    if (tab.kind === 'board') {
      if (panel === undefined) return Promise.resolve(undefined);
      if (panel === null) return Promise.resolve(null);
      return getCard(panel.cardId).then((c) => c ?? null);
    }
    if (tab.kind === 'article') {
      return cardByArticleKey(tab.articleKey).then((c) => c ?? null);
    }
    return Promise.resolve(undefined);
  }, [tab.kind, tab.kind === 'board' ? panel?.cardId : tab.kind === 'article' ? tab.articleKey : null]);

  /*
   * Asked only of a focused article. Capture reads the page the reader is
   * looking at, so a background article tab is not a target and the board tab
   * never is — neither has a permission worth checking.
   */
  const permission = useCapturePermission(tab.kind === 'article' ? tab.url : null);
  const activeTabGrantId = useActiveTabGrant();

  const [captureError, setCaptureError] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<AddArticleReply | null>(null);
  const [adding, setAdding] = useState(false);

  // Clear once the focused article changes, so a stale banner or error never
  // survives a tab switch.
  useEffect(() => {
    setAddResult(null);
  }, [tab.kind === 'article' ? tab.articleKey : tab.kind]);

  const view = panelView(
    tab,
    panel === undefined ? undefined : panel === null ? null : panel.cardId,
    card,
    permission,
    activeTabGrantId,
  );

  async function addArticle(tabId: number, url: string) {
    setAdding(true);
    const reply = (await browser.runtime.sendMessage({
      type: 'add-article',
      tabId,
      url,
    } satisfies PanelMessage)) as AddArticleReply;
    setAdding(false);
    setAddResult(reply);
  }

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
        <p className="empty">Open an article.</p>
      </Shell>
    );
  }

  if (view.kind === 'board-idle') {
    return (
      <Shell>
        <p className="empty">Select an article to view.</p>
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

  if (view.kind === 'draft') {
    /*
     * A card that does not exist, shown so the reader can see what adding the
     * article would give them. Every field takes the empty default
     * `createCard` would give a brand-new card, and every input under it is
     * disabled: nothing here may reach Dexie.
     */
    const placeholder: Card = {
      id: '__draft__',
      url: view.url,
      articleKey: tab.kind === 'article' ? tab.articleKey : '',
      title: view.title || view.url,
      author: '',
      publication: '',
      status: 'to_read',
      savedAt: '',
      exportVersion: 0,
      tags: [],
      notes: '',
      quotes: [],
      sortOrder: 0,
    };

    // Re-derived rather than cast: 'draft' only ever arises from an article
    // tab, but the narrowing does not survive the `view` binding.
    const draftTabId = tab.kind === 'article' ? tab.tabId : null;

    return (
      <Shell>
        <div className="draft">
          <div className="draft-preview" aria-hidden="true">
            <CardEditor card={placeholder} preview />
          </div>
          <div className="draft-overlay">
            {addResult && !addResult.ok ? <p className="banner warn">{addResult.reason}</p> : null}
            <button
              className="add-article"
              disabled={adding || draftTabId == null}
              onClick={() => {
                if (draftTabId != null) void addArticle(draftTabId, view.url);
              }}
            >
              Add to board and start taking notes
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const { card: shown, capture } = view;
  const banner = addResult?.ok ? addResult.outcome : null;
  const notices = addResult?.ok ? addResult.notices : [];

  async function handleDelete() {
    if (!window.confirm(`Delete "${shown.title}"? This cannot be undone.`)) return;
    await deleteCard(shown.id);
    // No close and no state to clear. The live query loses the row, the view
    // turns to 'gone' or back to a draft, and the board's outline goes with
    // the tile.
  }

  // Greys the "Open the board" button when the board is already in front of
  // the reader, so the button never promises a jump it cannot make.
  const boardFocused = tab.kind === 'board';

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
             * the panel look like a different thing depending on which tab is
             * focused, which is the confusion this whole change removes.
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
            * Greyed only while the board is the focused tab, where a click would
            * do nothing: the background's `openBoard` would focus the tab that
            * is already in front of the reader. Every other time — no board tab,
            * or one sitting in the background — it is live and one click away.
            * Same disabled-when-pointless rule as the Capture button.
            */}
          <button
            className="open-board"
            onClick={openBoard}
            disabled={boardFocused}
            title={boardFocused ? "You're on the board." : undefined}
          >
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
