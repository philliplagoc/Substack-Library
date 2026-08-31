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

## Capture from an article page

- [x] Toolbar click on a free Substack article opens the side panel.
- [x] The panel says "Added to To Read." and shows the real title,
      publication, and author.
- [x] A reading estimate appears and is plausible for the article's length.
- [x] The card is in To Read on the board.
- [x] A second click on the same article says "Already on your board.
      Metadata refreshed."
- [x] A second click creates no duplicate card.
- [x] Clicking from the `open.substack.com/pub/.../p/...` share route finds
      the same card.
- [x] Toolbar click on a non-article page still opens the board.
- [x] Toolbar click on `chrome://extensions` opens the board and shows no
      error.
- [x] Toolbar click on a custom-domain publication captures a real title and
      publication.
- [x] A paywalled article creates a card, shows "Preview only", and leaves
      the minutes blank.
- [x] Signed out in a private window: the card is still created and the
      signed-out notice appears.

> The private-window box needs setup. Extensions do not run in incognito  
> until you allow it: `chrome://extensions`, this extension's Details, then  
> "Allow in Incognito".

## Reader routes

Not in the plan. Added 2026-08-30 after the toolbar button opened the board  
on a home-feed post. These are the app's own reader shells, where `<head>`  
describes the shell and only the body knows which article is open.

- [x] A post opened from the inbox, `substack.com/inbox/post/<id>`, makes a
      card with the post's own title and URL.
- [x] A post opened from the home feed, `substack.com/home/post/p-<id>`, does
      the same. Passed 2026-08-30, first run. The home shell and the inbox
      shell lay out alike, so one `readReaderArticle` reads both.
- [ ] A post opened from a profile-scoped link,
      `substack.com/@<handle>/p-<id>`, opens the side panel and makes a card
      with the post's own title and URL. Added 2026-08-30 after the toolbar
      button opened the board on that shape.
- [x] The same article opened from a reader route and from the publication's
      own page is one card, not two.
- [x] `substack.com/inbox/saved`, `substack.com/home`, and a bare
      `substack.com/@<handle>` profile page still open the board.

## Reading panel

- [x] Notes typed in the panel appear on the board's detail panel after a
      reload.
- [x] Notes typed on the board appear in the panel without a reload.
- [x] The three status buttons move the card, and the current status is
      disabled.
- [x] Moving to Reading puts the card at the TOP of the Reading column.
- [x] The panel keeps showing the previous article when you switch tabs
      without clicking.
- [x] Narrowing the panel to its minimum leaves the quote comment boxes
      usable.

## Quotes

Six of these were run as Task 7 Step 14 on 2026-08-30 and are ticked from  
that pass. Only the reload box is new.

- [x] Selecting text and clicking "Capture quote" adds the quote verbatim.
- [x] A comment typed on a quote survives a reload.
- [x] A comment typed on a quote is editable from the board's detail panel
      too.
- [x] "Capture quote" with nothing selected says so and adds nothing.
- [x] Capturing a passage that appears twice in the article adds exactly one
      quote.
- [x] Editing the article in DevTools so a quote no longer matches shows
      "location unavailable".
- [x] A quote whose location is lost still shows its full text.

## Markdown export (Milestone 2B)

Load the unpacked build from `extension/.output/chrome-mv3/` first.

- [x] Open a Substack article, click the toolbar button, and click **Export
      Markdown** in the panel. A file appears in Downloads named
      `YYYY-MM-DD - <title>.md`, dated by when the card was SAVED, not today.
- [x] Open that file in a text editor. The frontmatter fences are `---`, the
      title is double-quoted, and every quote and note on the card is present.
- [x] Click **Export Markdown** again on the same card. The second file carries
      ` (v2)` before `.md` and the first file is untouched.
- [x] Open the board, open a card's detail panel, and export from there. Same
      file shape.
- [x] Export a card in To Read, then answer **Yes** to "Move to Processed?".
      The card appears at the TOP of the Processed column.
- [x] Export another card and answer **Not yet**. The card does not move and the
      plain Export button comes back.
- [x] Export a card already in Processed. The file is written and NO offer
      appears.
- [x] Export a card with no notes and no quotes. The file holds frontmatter and
      nothing else. This is correct, not a bug.
- [x] Export a card whose article was paywalled. `reading_minutes` is absent
      from the frontmatter rather than present and empty.
- [x] Export a card that has never been moved to Reading. `read:` is absent.
- [x] Copy one exported file into an Obsidian vault, using a card that has been
      read and has a reading estimate so all eight keys are present. The
      Properties view reads title, author, publication, url, saved, read,
      reading_minutes, and tags.
- [x] Edit an article after quoting it so the panel shows "location
      unavailable", then export. The quote text is intact and an italic line
      under it reads "location no longer resolves in the source article".
- [x] NOT A BUG: if a file with the generated name already exists, Chrome
      appends its own ` (1)`, so a name can land as `... (v2) (1).md`. The
      extension cannot read the Downloads folder and cannot prevent this. No
      previous file is ever lost.
