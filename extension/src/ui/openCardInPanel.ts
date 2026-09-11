import { browser } from 'wxt/browser';
import { PANEL_STATE_KEY, type PanelState } from '../messages';
import type { OwnTab } from './useOwnTab';
import type { Card } from '../domain/types';

/**
 * Show a board card in the side panel.
 *
 * Not `async`, and nothing here is awaited. `sidePanel.open()` is honoured only
 * while the click that led to it still counts as a user gesture, and the first
 * `await` in the chain spends it. `background.ts` has the same constraint and
 * solves it by opening the panel before it captures anything.
 *
 * The state is written before the panel is asked to open. A queued card with no
 * panel yet resolves itself a moment later, when the panel boots and reads the
 * key. A panel with no card queued would paint the previous article first.
 *
 * @returns a promise that settles when the panel opens, or rejects with a
 *   sentence worth showing the reader.
 */
export function openCardInPanel(card: Card, tab: OwnTab): Promise<void> {
  void browser.storage.session.set({
    [PANEL_STATE_KEY]: { cardId: card.id } satisfies PanelState,
  });

  // Tab-scoped first, matching the toolbar path in `background.ts`. Window
  // scope is the fallback for the case where the page could not learn its own
  // tab id.
  if (tab.tabId != null) {
    return browser.sidePanel
      .open({ tabId: tab.tabId })
      .catch(() =>
        tab.windowId != null
          ? browser.sidePanel.open({ windowId: tab.windowId })
          : Promise.reject(new Error('no window')),
      );
  }

  if (tab.windowId != null) {
    return browser.sidePanel.open({ windowId: tab.windowId });
  }

  return Promise.reject(new Error('no tab'));
}
