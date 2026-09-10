import { describe, expect, it } from 'vitest';
import { captureTarget, panelView } from './panelView';
import type { LiveArticle } from './useLiveArticle';
import type { PanelState } from '../messages';
import type { Card } from '../domain/types';

function card(over: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    url: 'https://alpha.substack.com/p/one',
    articleKey: 'alpha/p/one',
    title: 'One',
    author: '',
    publication: 'alpha',
    status: 'to_read',
    savedAt: '2026-09-09T00:00:00.000Z',
    exportVersion: 0,
    tags: [],
    notes: '',
    quotes: [],
    ...over,
  } as Card;
}

const captured: PanelState = {
  source: 'capture',
  articleKey: 'alpha/p/one',
  tabId: 7,
  outcome: 'added',
  notices: ['Preview only — reading time unavailable.'],
};

const clicked: PanelState = { source: 'board', cardId: 'card-1' };

const checking: LiveArticle = { kind: 'checking' };
/** Focused on something that is not this article, and no id worth naming. */
const closed: LiveArticle = { kind: 'closed', activeTabId: 99 };
/** The reader is focused on the article, and the extension may read it. */
const openAt = (tabId: number): LiveArticle => ({ kind: 'open', tabId });
/** Focused on the article, but no permission for the publication yet. */
const askOn = (activeTabId: number | null): LiveArticle => ({
  kind: 'ask',
  pattern: 'https://alpha.substack.com/*',
  host: 'alpha.substack.com',
  activeTabId,
});
const ask = askOn(7);

describe('panelView', () => {
  it('waits while the panel state is still being read', () => {
    expect(panelView(undefined, undefined, checking).kind).toBe('loading');
  });

  it('prompts when nothing has been opened', () => {
    expect(panelView(null, undefined, checking).kind).toBe('prompt');
  });

  it('waits while the card query is still running', () => {
    expect(panelView(captured, undefined, checking).kind).toBe('loading');
    expect(panelView(clicked, undefined, checking).kind).toBe('loading');
  });

  it('reports a capture that produced no card', () => {
    const view = panelView({ ...captured, outcome: 'rejected', articleKey: '' }, null, closed);
    expect(view).toEqual({
      kind: 'rejected',
      outcome: 'rejected',
      notices: captured.notices,
    });
  });

  it('says a board card is gone rather than blaming the page', () => {
    expect(panelView(clicked, null, closed).kind).toBe('gone');
  });

  it('shows a captured card with its banner and its notices', () => {
    // Focused on the tab the toolbar click covered, which is where a reader
    // stands the moment after a capture.
    const view = panelView(captured, card(), { kind: 'closed', activeTabId: 7 });
    expect(view).toMatchObject({
      kind: 'card',
      banner: 'added',
      notices: captured.notices,
      capture: { kind: 'ready', tabId: 7 },
    });
  });

  it('shows a board card with no banner and no notices', () => {
    const view = panelView(clicked, card(), closed);
    expect(view).toMatchObject({ kind: 'card', banner: null, notices: [] });
  });

  // The reader clicked a second card. The state flipped; the live query has
  // not caught up. Showing the new banner over the old body is worse than a
  // flicker of "Loading…".
  it('waits rather than paint the previous card under a new state', () => {
    expect(panelView(clicked, card({ id: 'card-2' }), closed).kind).toBe('loading');
    expect(panelView(captured, card({ articleKey: 'beta/p/two' }), closed).kind).toBe('loading');
  });

  // Identity is per source. A board opening addresses the card by its own id,
  // because two cards can share one articleKey.
  it('matches a board card by id, not by article key', () => {
    const duplicate = card({ id: 'card-2', articleKey: 'alpha/p/one' });
    expect(panelView(clicked, duplicate, closed).kind).toBe('loading');
    expect(panelView({ source: 'board', cardId: 'card-2' }, duplicate, closed).kind).toBe('card');
  });
});

/*
 * Capture needs a tab AND the right to inject into it, and the panel state
 * says nothing about either: it records how the panel was opened and never
 * changes after. A reader who opened the panel from the board and then walked
 * to the article has a live page in front of them and a frozen state behind.
 */
describe('captureTarget', () => {
  it('reads from a granted tab showing the article, however the panel opened', () => {
    expect(captureTarget(clicked, openAt(12))).toEqual({ kind: 'ready', tabId: 12 });
  });

  it('offers the publication when the extension may not look at tabs', () => {
    expect(captureTarget(clicked, ask)).toEqual({
      kind: 'ask',
      pattern: 'https://alpha.substack.com/*',
      host: 'alpha.substack.com',
    });
  });

  it('has nothing to read when the article is not the focused tab', () => {
    expect(captureTarget(clicked, closed)).toEqual({ kind: 'absent' });
  });

  /*
   * The toolbar's `activeTab` grant is still the floor under the other
   * answers, but it is a floor under ONE tab. Once the reader focuses
   * somewhere else, the grant covers a page they are no longer looking at,
   * and a quote read out of it would not be the quote they selected.
   */
  it('drops the toolbar grant once the reader focuses another tab', () => {
    expect(captureTarget(captured, { kind: 'closed', activeTabId: 99 })).toEqual({
      kind: 'absent',
    });
  });

  it('keeps the toolbar grant while its own tab is still focused', () => {
    expect(captureTarget(captured, { kind: 'closed', activeTabId: 7 })).toEqual({
      kind: 'ready',
      tabId: 7,
    });
  });

  it('prefers the toolbar grant over asking for its own focused tab', () => {
    expect(captureTarget(captured, askOn(7))).toEqual({ kind: 'ready', tabId: 7 });
  });

  it('asks for the publication when the focused tab is not the captured one', () => {
    expect(captureTarget(captured, askOn(99))).toEqual({
      kind: 'ask',
      pattern: 'https://alpha.substack.com/*',
      host: 'alpha.substack.com',
    });
  });

  // Neither answer is known yet. A button that flickers from enabled to
  // disabled is worse than one that arrives disabled and turns on.
  it('stays absent while the permission and the tab list are still being read', () => {
    expect(captureTarget(clicked, checking)).toEqual({ kind: 'absent' });
  });
});
