import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Substack Library',
    description: 'A three-column reading board for Substack articles.',
    permissions: [
      'storage',
      'activeTab',
      'scripting',
      'tabs'
    ],
    // activeTab covers a tab the reader clicked the toolbar button on. Sync is
    // triggered from the board and injects into a tab the extension opened, so
    // activeTab grants nothing there. `tabs` is what lets the panel follow the
    // focused tab at all: without it Chrome withholds a tab's `url` and `title`
    // from `tabs.query` unless some other grant already covers that tab, and
    // the panel now has to classify EVERY tab the reader switches to, not only
    // the one an activeTab or host-permission grant happens to reach. Narrow on
    // purpose: the Saved list is only ever served from substack.com.
    host_permissions: ['https://substack.com/*'],
    // Asked for one publication at a time, from a click in the side panel, and
    // never at install. `activeTab` arms Capture only on the tab the toolbar
    // button was clicked on, so a reader who reached the article by following a
    // link had a Capture button that could never work. Granting an origin here
    // is what lets the panel both SEE that the article is open — tab URLs are
    // hidden without a matching host permission — and read a selection out of
    // it. `<all_urls>` at install would buy the same thing for the price of the
    // "read and change all your data on all websites" warning on a reader who
    // may only ever use one publication.
    optional_host_permissions: ['*://*/*'],
    action: {
      default_title: 'Open Substack Library',
    },
  },
});