# Manual checks

`npm test` covers `src/domain/` and `src/db/`. Nothing tests `src/ui/`.  
This list is the check on that layer. Run it whole.

Setup: `cd extension; npm run build`, then reload the extension on  
`chrome://extensions`, then click the toolbar button.

## Shell

- [x] The toolbar button opens the board in a new tab.
- [x] A second click focuses that tab. No second tab opens.
- [x] Close the tab, click again. A new tab opens.

## Capture

- [x] Add by URL with a title, author, publication, and minutes. The card
      appears in To Read.
- [x] Add the same URL again. The message says it is already on the board.
      No second card appears.
- [x] Add `hello`. A red message names the problem. No card appears.
- [x] Add a URL with `?utm_source=x` on the end of a URL already added.
      It refreshes the existing card.
- [x] Add `https://www.<pub>.com/p/<slug>`, then
      `https://open.substack.com/pub/<pub>/p/<slug>`. One card, not two.
      The message says it is already on the board.
- [x] The card still links to the URL you added it with, not the share route.
- [x] Add `https://<pub>.substack.com/p/<slug>` for that same article.
      Still one card.
- [x] Two publications that both use the same slug stay two cards.
      Skipped by hand. Covered by `url.test.ts` ("separates the same slug in
      two publications") and `cards.test.ts` ("still separates the same slug
      in two publications"), which reach the same dedup index the UI writes to.

## Migration to schema version 2

Run these once, on a board that holds cards from before the article-key fix.

An IndexedDB upgrade runs once and cannot be undone. The browser writes the  
version number to disk, so the moment the board opens on the new build the  
upgrade is spent. Build the version 1 board first.

Delete the database before you start. This step is the one that makes the check  
real, and it is not optional. Dexie does not refuse to open a version 2  
database with version 1 code. It opens it, reports `verno` 1, and writes rows  
that carry no `articleKey`. The version on disk stays at 2. The version 2 build  
then sees a current database, skips the upgrade, and you are left testing  
nothing while the board fills with keyless rows that no dedup lookup can see.

Setup:

1. Export JSON from the board and keep the file. The wipe below is real.
2. Close every board tab. An open tab holds the database and blocks both the
  delete and the version change.
3. Delete the database. Open the service worker console from
  `chrome://extensions` (the "service worker" link on this extension) and run  
   `indexedDB.deleteDatabase('substack-library')`. Use that console, not the  
   board's: it shares the origin but holds no connection of its own.
4. `git stash push extension/src`. The article-key fix is uncommitted, so this
  leaves the extension at the last commit, which is version 1 of the schema.  
   Naming the path keeps the stash off `changes.log` and the docs.
5. `cd extension; npm run build`. Reload the extension on `chrome://extensions`.
6. Open the board and build a board worth migrating:
  - Add `https://www.<pub>.com/p/<slug>` for a real article.
  - Add two or three more cards. Drag one to Reading.
  - Open a card and type notes into it. Tick Liked.
7. Confirm you are on version 1 before you go on. In the board console:
  `indexedDB.open('substack-library').onsuccess = e =>`  
   `console.log(e.target.result.version)`. It must print `10`, which is Dexie  
   version 1. A `20` means the delete in step 3 did not take, and the rest of  
   this section will pass without testing anything.
8. Close every board tab again.
9. `git stash pop`, then `npm run build`, then reload the extension.
10. Open the board. The upgrade runs as it opens.

Restore the backup from step 1 when you are done.

- [x] The board opens. It does not show the error boundary.
- [x] Every card that was there is still there, with its notes.
- [x] A card added before the fix now dedups against its other routes.
      Add `https://open.substack.com/pub/<pub>/p/<slug>` for the article from
      step 6. The message says it is already on the board. No second card.

## Board

- [x] Card faces show title, publication and author, and minutes.
      No saved date is shown.
- [x] Search narrows the board.
- [x] Max minutes of 10 hides a 40-minute card.
- [x] Max minutes of 10 also hides a card with no estimate.
- [x] Clearing Max minutes shows the no-estimate card again.

## Drag and drop

- [x] Drag a card from To Read to Reading. Reload. It stays.
- [x] Drag a card up inside a column. Reload. The order holds.
- [x] Drag a card into an empty column.
- [x] Tab to a card, press Space, use the arrow keys, press Space.
      The card moves.

## Panel

- [x] Click a card. The panel opens on the right.
- [x] Type notes. Reload. The notes are there.
- [x] The card face gains a "notes" status line.
- [x] Tick Liked. Reload. It stays ticked.
- [x] Click Delete. A confirmation appears. Cancel. The card stays.
- [x] Click Delete. Confirm. The card goes and the panel closes.

## Backup

- [x] Export JSON downloads a file that holds your notes.
- [x] Delete a card, then restore the file. The card returns with its notes.
- [x] Restore reports added and replaced counts.
- [x] Restore a file with one broken record. The good records restore and
      the message names the broken one by index.
