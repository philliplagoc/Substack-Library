// The toolbar action. It opens the board, or focuses the board tab it already opened.
import { shouldCaptureFrom } from '../domain/url';

export default defineBackground({
  main() {
    const BOARD_PATH = '/board.html';

    async function openBoard() {
      const { boardTabId } = await browser.storage.session.get('boardTabId');

      if (typeof boardTabId === 'number') {
        try {
          const tab = await browser.tabs.update(boardTabId, { active: true });
          if (tab?.windowId != null) {
            await browser.windows.update(tab.windowId, { focused: true });
          }
          return;
        } catch {
          // The remembered tab is gone. Fall through and open a new one.
        }
      }

      const tab = await browser.tabs.create({ url: browser.runtime.getURL(BOARD_PATH) });
      if (tab.id != null) {
        await browser.storage.session.set({ boardTabId: tab.id });
      }
    }

    browser.action.onClicked.addListener(async (tab) => {
      if (!shouldCaptureFrom(tab.url) || tab.id == null) {
        await openBoard();
        return;
      }
      // Task 6 extracts, ingests, and records state here.
      await browser.sidePanel.open({ tabId: tab.id });
    });
  },
});