import { describe, expect, it } from 'vitest';
import { classifyTab } from './focusedTab';

const boardUrl = 'chrome-extension://abcdefg/board.html';

function tab(over: { id?: number; url?: string; title?: string } = {}) {
  return { id: 7, url: 'https://alpha.substack.com/p/one', title: 'One', ...over };
}

describe('classifyTab', () => {
  it('classifies a null tab as other with no id', () => {
    expect(classifyTab(null, undefined, boardUrl)).toEqual({ kind: 'other', tabId: null });
  });

  it('matches the board by tab id', () => {
    expect(classifyTab(tab({ url: undefined }), 7, boardUrl)).toEqual({ kind: 'board', tabId: 7 });
  });

  it('matches the board by url with a trailing query', () => {
    expect(classifyTab(tab({ url: `${boardUrl}?x=1` }), undefined, boardUrl)).toEqual({
      kind: 'board',
      tabId: 7,
    });
  });

  it('matches the board by url with a trailing hash', () => {
    expect(classifyTab(tab({ url: `${boardUrl}#open` }), undefined, boardUrl)).toEqual({
      kind: 'board',
      tabId: 7,
    });
  });

  it('classifies a /p/<slug> article url', () => {
    expect(classifyTab(tab(), undefined, boardUrl)).toEqual({
      kind: 'article',
      tabId: 7,
      url: 'https://alpha.substack.com/p/one',
      articleKey: 'alpha/p/one',
      title: 'One',
    });
  });

  it('classifies a /pub/<pub>/p/<slug> share-route article url', () => {
    const url = 'https://open.substack.com/pub/alpha/p/one';
    expect(classifyTab(tab({ url, title: undefined }), undefined, boardUrl)).toEqual({
      kind: 'article',
      tabId: 7,
      url,
      articleKey: 'alpha/p/one',
      title: '',
    });
  });

  it('classifies a reader route as an article', () => {
    const url = 'https://substack.com/inbox/post/12345';
    expect(classifyTab(tab({ url }), undefined, boardUrl)).toMatchObject({
      kind: 'article',
      tabId: 7,
      url,
    });
  });

  it('classifies a non-Substack url as other', () => {
    expect(classifyTab(tab({ url: 'https://example.com/' }), undefined, boardUrl)).toEqual({
      kind: 'other',
      tabId: 7,
    });
  });

  it('classifies a tab with no url at all as other, the pre-permission case', () => {
    expect(classifyTab(tab({ url: undefined }), undefined, boardUrl)).toEqual({
      kind: 'other',
      tabId: 7,
    });
  });
});
