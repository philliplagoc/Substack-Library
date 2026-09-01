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
      'scripting'
    ],
    // activeTab covers a tab the reader clicked the toolbar button on. Sync is
    // triggered from the board and injects into a tab the extension opened, so
    // activeTab grants nothing there. Narrow on purpose: the Saved list is only
    // ever served from substack.com.
    host_permissions: ['https://substack.com/*'],
    action: {
      default_title: 'Open Substack Library',
    },
  },
});