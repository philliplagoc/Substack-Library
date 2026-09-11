import { describe, expect, it } from 'vitest';
import { captureTarget, panelView } from './panelView';
import type { FocusedTab } from './focusedTab';
import type { CapturePermission } from './useCapturePermission';
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

const checking: FocusedTab = { kind: 'checking' };
const other: FocusedTab = { kind: 'other', tabId: 99 };
const board: FocusedTab = { kind: 'board', tabId: 3 };
const article = (over: Partial<Extract<FocusedTab, { kind: 'article' }>> = {}): FocusedTab => ({
  kind: 'article',
  tabId: 7,
  url: 'https://alpha.substack.com/p/one',
  articleKey: 'alpha/p/one',
  title: 'One',
  ...over,
});

const granted: CapturePermission = { kind: 'granted' };
const ask: CapturePermission = {
  kind: 'ask',
  pattern: 'https://alpha.substack.com/*',
  host: 'alpha.substack.com',
};
const unavailable: CapturePermission = { kind: 'unavailable' };
const pending: CapturePermission = { kind: 'checking' };

describe('panelView', () => {
  it('waits while the focused tab is still being classified', () => {
    expect(panelView(checking, undefined, undefined, pending, null).kind).toBe('loading');
  });

  it('prompts when the focused tab is neither the board nor an article', () => {
    expect(panelView(other, null, null, pending, null).kind).toBe('prompt');
  });

  it('waits on the board while the pick is still being read', () => {
    expect(panelView(board, undefined, undefined, pending, null).kind).toBe('loading');
  });

  it('sits idle on the board until a card is clicked', () => {
    expect(panelView(board, null, undefined, pending, null).kind).toBe('board-idle');
  });

  it('waits on the board while the picked card is still being queried', () => {
    expect(panelView(board, 'card-1', undefined, pending, null).kind).toBe('loading');
  });

  it('says a picked card is gone rather than blaming the page', () => {
    expect(panelView(board, 'card-1', null, pending, null).kind).toBe('gone');
  });

  // The reader clicked a second card. The pick flipped; the live query has not
  // caught up, and one card's notes painted under another's title is worse
  // than a flicker of "Loading…".
  it('waits rather than paint the previous card under a new pick', () => {
    expect(panelView(board, 'card-2', card(), pending, null).kind).toBe('loading');
  });

  it('shows the picked board card', () => {
    expect(panelView(board, 'card-1', card(), pending, null)).toEqual({
      kind: 'card',
      card: card(),
      // Capture never reads from the board tab itself.
      capture: { kind: 'absent' },
    });
  });

  it('waits on an article while its card is still being queried', () => {
    expect(panelView(article(), null, undefined, granted, null).kind).toBe('loading');
  });

  it('offers to add an article that is not on the board', () => {
    expect(panelView(article(), null, null, granted, null)).toEqual({
      kind: 'draft',
      url: 'https://alpha.substack.com/p/one',
      title: 'One',
      capture: { kind: 'ready', tabId: 7 },
    });
  });

  // Switched to a second article. Same race as the board's, one tab away.
  it('waits rather than paint the previous article under a new tab', () => {
    expect(panelView(article({ articleKey: 'beta/p/two' }), null, card(), granted, null).kind).toBe(
      'loading',
    );
  });

  it("shows the focused article's card", () => {
    expect(panelView(article(), null, card(), granted, null)).toEqual({
      kind: 'card',
      card: card(),
      capture: { kind: 'ready', tabId: 7 },
    });
  });
});

/*
 * Capture needs a tab AND the right to inject into it. The host permission is
 * the general answer; the toolbar's activeTab grant is a floor under it, good
 * for exactly one tab.
 */
describe('captureTarget', () => {
  it('reads from the focused article once its publication is granted', () => {
    expect(captureTarget(article(), granted, null)).toEqual({ kind: 'ready', tabId: 7 });
  });

  it('reads from the tab the toolbar grant covers, with no host permission', () => {
    expect(captureTarget(article(), ask, 7)).toEqual({ kind: 'ready', tabId: 7 });
  });

  it('drops the toolbar grant once the reader focuses another article', () => {
    expect(captureTarget(article({ tabId: 12 }), ask, 7)).toEqual({
      kind: 'ask',
      pattern: 'https://alpha.substack.com/*',
      host: 'alpha.substack.com',
    });
  });

  it('offers the publication when the extension may not read the article', () => {
    expect(captureTarget(article(), ask, null)).toEqual({
      kind: 'ask',
      pattern: 'https://alpha.substack.com/*',
      host: 'alpha.substack.com',
    });
  });

  it('has nothing to read when the focused tab is not an article', () => {
    expect(captureTarget(board, granted, 3)).toEqual({ kind: 'absent' });
    expect(captureTarget(other, granted, 99)).toEqual({ kind: 'absent' });
    expect(captureTarget(checking, granted, null)).toEqual({ kind: 'absent' });
  });

  // Neither answer is known yet, and a URL with no origin to ask for never
  // will be. A button that flickers from enabled to disabled is worse than one
  // that arrives disabled and turns on.
  it('stays absent while the permission is unknown or unaskable', () => {
    expect(captureTarget(article(), pending, null)).toEqual({ kind: 'absent' });
    expect(captureTarget(article(), unavailable, null)).toEqual({ kind: 'absent' });
  });
});
