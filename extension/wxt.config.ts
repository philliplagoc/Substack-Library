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
    action: {
      default_title: 'Open Substack Library',
    },
  },
});