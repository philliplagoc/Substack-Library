# Manual checks

`npm test` covers `src/domain/` and `src/db/`. Nothing tests `src/ui/`.  
This list is the check on that layer. Run it whole.

Setup: `cd extension; npm run build`, then reload the extension on  
`chrome://extensions`, then click the toolbar button.

## Shell

- [x] The toolbar button opens the board in a new tab.
- [x] A second click focuses that tab. No second tab opens.
- [x] Close the tab, click again. A new tab opens.

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

- [x] Card faces show title, publication and author. No saved date is shown,
      and no reading-time estimate.
- [x] Search narrows the board.

## Drag and drop

- [x] Drag a card from To Read to Reading. Reload. It stays.
- [x] Drag a card up inside a column. Reload. The order holds.
- [x] Drag a card into an empty column.
- [x] Tab to a card, press Space, use the arrow keys, press Space.
      The card moves.

## Panel

Rewritten on 2026-09-09. The board no longer holds a panel of its own; a card
opens Chrome's side panel, the same one the toolbar button opens.

- [ ] Click a card. Chrome's side panel opens showing that card.
- [ ] Type notes. Reload. The notes are there.
- [ ] The card face gains a "notes" status line.
- [ ] Click Delete card. A confirmation appears. Cancel. The card stays.
- [ ] Click Delete card. Confirm. The card goes from the board and the panel
      says it is no longer on your board.
- [x] Open a card from the board while the article is open in a background tab
      of the same window. Capture stays disabled and reads "Open the article
      first." Focus the article tab; Capture turns on without a reload.
- [ ] Toolbar-capture an article, then focus another tab. Capture turns off.
      Focus the article tab again; Capture turns back on.

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
- [x] A post opened from a profile-scoped link,
      `substack.com/@<handle>/p-<id>`, opens the side panel and makes a card
      with the post's own title and URL. Added 2026-08-30 after the toolbar
      button opened the board on that shape. Passed 2026-08-31, first run. All
      three reader shells lay out alike, so one `readReaderArticle` reads them
      all.
- [x] The same article opened from a reader route and from the publication's
      own page is one card, not two.
- [x] `substack.com/inbox/saved`, `substack.com/home`, and a bare
      `substack.com/@<handle>` profile page still open the board.
- [x] `substack.com/saved` opens the board rather than attempting a capture.
- [x] Sync opens `substack.com/saved`, not `substack.com/inbox/saved`, and the
      run reports roughly the number of articles that page shows. Re-check
      after the route change of 2026-08-31.
- [x] A card added by that sync shows `— min` on its tile, and opening the
      article once fills the reading time in. The Saved page carries no
      estimate; the capture computes one from the body.

## Reading panel

- [ ] Notes typed in the panel change the card face on the board without a
      reload.
- [x] The panel keeps showing the previous article when you switch tabs
      without clicking.
- [x] Narrowing the panel to its minimum leaves the quote comment boxes
      usable.
- [ ] Open the same card in two Chrome windows, each with its own side panel.
      Type in one; the other does not revert it.

## Quotes

All but the reload box were run as Task 7 Step 14 on 2026-08-30 and are  
ticked from that pass.

- [x] Selecting text and clicking "Capture quote" adds the quote verbatim.
- [x] A comment typed on a quote survives a reload.
- [ ] A comment typed on a quote is still there when the same card is opened
      from the board.
- [x] "Capture quote" with nothing selected says so and adds nothing.
- [x] Capturing a passage that appears twice in the article adds exactly one
      quote.

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
- [x] Export a card already in Processed. The file is written.
- [x] Export a card with no notes and no quotes. The file holds frontmatter and
      nothing else. This is correct, not a bug.
- [x] Export a card whose article was paywalled. `reading_minutes` is absent
      from the frontmatter rather than present and empty.
- [x] Export a card that has never been moved to Reading. `read:` is absent.
- [x] Copy one exported file into an Obsidian vault, using a card that has been
      read and has a reading estimate so all eight keys are present. The
      Properties view reads title, author, publication, url, saved, read,
      reading_minutes, and tags.
- [x] NOT A BUG: if a file with the generated name already exists, Chrome
      appends its own ` (1)`, so a name can land as `... (v2) (1).md`. The
      extension cannot read the Downloads folder and cannot prevent this. No
      previous file is ever lost.

## Saved sync (Milestone 3)

Reload the extension first. This milestone adds a host permission, and

Chrome may show it as newly requested or disable the extension until it is

accepted.

- [x] Click **Import Saved Articles** on the board. A Substack Saved tab opens, visibly scrolls to the bottom, and the board reports counts.

- [x] The reported total matches the number of entries visible on the page after the scroll finishes.
- [x] New saved articles arrive as cards in To Read with a title, publication, author, and a reading estimate.
- [x] Sync a second time. The second run reports 0 added and the same number refreshed.
- [x] A card moved to Processed is STILL in Processed after a sync, even though the article is still saved on Substack.
- [x] Notes and quotes on a card survive a sync.
- [x] Unsave an article on Substack, sync, and its card carries the warning and has NOT moved column or been deleted.
- [x] Re-save it, sync, and the warning is gone.
- [x] A card added by URL, never in the Saved list, carries no warning after a sync.
- [x] A saved podcast becomes a card whose face reads its full duration and "watch" or "listen".
- [x] Sync signed out, in a private window: the message says to sign in, and NO card gains a warning.
- [x] The first-run backlog: on an empty board, one sync brings in every saved entry.

## Milestone 4: release polish

Reload the extension first: this milestone changes the Dexie schema to version  
3, and the upgrade runs the first time the board opens.

### The board button

- [x] The side panel's "Open the board" button opens the board.
- [x] With the board already open in another tab, the button focuses that tab
      rather than opening a second one.
- [x] Close the board tab, then click the button; a new board opens.

### Tags

- [x] Type a tag in the side panel and press Enter; the chip appears.
- [x] Reload the board; the chip is still there.
- [x] Type a tag and press comma; the chip appears and holds no comma.
- [x] Type a tag, then click away without pressing Enter; the chip appears.
- [x] Type a tag already used on another card; it is offered as a suggestion.
- [x] Add the same tag twice; one chip.
- [x] Type `AI` on one card and `ai` on another; the filter row shows one button
      and both cards match it.
- [x] Remove a chip with its ×.
- [x] Remove a chip with Backspace in an empty tag input.
- [x] The same tag editor works in the board's detail panel.

### The tag filter

- [x] A board with no tags shows no filter row.
- [x] Select one tag; only cards carrying it remain.
- [x] Select a second tag; only cards carrying BOTH remain.
- [x] Click a selected tag again; it deselects.
- [x] Select a tag and type in the search box; both filters apply.
- [x] Make enough tags to overflow the strip; it scrolls sideways and the board
      still reaches the bottom of the window.

### The Substack section

- [x] The board's detail panel has no Substack heading and no checkboxes.
- [x] Every other control in that panel still works: notes, quotes, export,
      delete.

### Export all

- [x] Export all on an unfiltered board; every card is in the file under the
      right column heading.
- [x] Export all with a tag selected; only those cards are in the file, and
      `count` matches how many.
- [x] Export a single card immediately after an export-all; the file is `v1`,
      not `v2`.
- [x] A board with an empty column exports that heading with `*No cards.*`
      under it.
- [x] Filter until nothing is left; the Export all button is disabled.
- [x] Open the library file in Obsidian; the frontmatter parses and the card
      headings nest under the column headings.

## 2026-09-03: reading workflow feedback

### Removing a quote

- [x] Capture three quotes and write a different comment on each. Remove the
      first; the other two keep their own comments.
- [x] Remove a quote and cancel the confirmation; nothing is removed.
- [x] Remove the only quote on a card; the panel shows "No quotes yet."
- [x] Remove a quote in the side panel while the board's detail panel shows the
      same card; the board updates without a refresh.

### The saved indicator

- [x] Type in Notes and stop. "Saving…" appears, becomes "✓ Saved", and goes
      away after about two seconds.
- [x] Type in a quote comment; the same indicator runs, next to the title.
- [x] Type continuously for ten seconds; the indicator stays on "Saving…" and
      does not flicker between states on every keystroke.
- [x] Open the panel and touch nothing; no indicator is shown.
- [x] Type a comment, then reopen the card; the comment is there.
- [x] Open the same card in the side panel and the board's detail panel. Type a
      comment in one; the other shows it and does not revert it.

### No button moves a card

- [x] The side panel has no To Read / Reading / Processed buttons.
- [x] Export a card from the side panel; no "Move to Processed?" offer appears.
- [x] Export a card from the board's detail panel; same.
- [x] Drag a card from To Read to Reading on the board; it moves and stays there
      after a refresh.

### Textarea resize

- [x] Drag the corner of the Notes box in the side panel; it grows and shrinks
      vertically only.
- [x] Same for a quote comment box.
- [x] Same for both boxes in the board's detail panel.

### Export format

- [x] Export a card with notes and quotes; the file has `## Notes` above
      `## Quotes`.
- [x] Export a card with quotes and no notes; there is no `## Notes` heading.
- [x] Export a card with notes and no quotes; there is no `## Quotes` heading.
- [x] Export all; each card has `#### Notes` and `#### Quotes` under its `###`
      title.
- [x] Open both files in Obsidian; the frontmatter parses and the headings nest.

### No quote location label

- [x] Open a card with quotes while its article tab is closed; no quote shows
      "location unavailable".
- [x] Capture a quote, close the article tab, refresh the board, and reopen the
      card; still no label.
- [x] An exported file contains no "location no longer resolves" line.

### Already done in Milestone 4, verified against this build

- [x] Build with `npm run build`, reload the unpacked extension from
      `extension/.output/chrome-mv3`, and open the board's detail panel. There
      is no Substack heading and no Liked / Commented / Unsaved checkbox.

## 2026-09-08: side panel redesign

Build with `npm run build` and reload the unpacked extension from
`extension/.output/chrome-mv3` first.

The earlier sections stay ticked: they record what passed when they were run.
The markup under the reading panel, quotes and tags changed in this work, so
those behaviours are listed again here and checked against the new build.

### The look

- [ ] Open a Substack article and click the toolbar button. The panel shows a
      green banner, an article card with an orange rule across its top, then
      plain white cards for tags, notes and quotes, on a parchment background.
- [ ] The publication is uppercase orange, the author is muted beside it, and
      the reading time sits right as a filled grey chip.
- [ ] The article title is in a serif face.
- [ ] The URL is a bordered pill that truncates with an ellipsis, and it turns
      orange on hover.
- [ ] Export Markdown and Open the board sit in a footer at the bottom of the
      panel. Scrolling the body does not move them.
- [ ] Capture sits in the Quotes heading, next to a count badge.
- [ ] No dark titlebar, no status buttons, no statistics line, no sync age.

### Fluid width

- [ ] Drag the panel to its narrowest. Nothing overflows sideways, no
      horizontal scrollbar appears, and the quote comment boxes stay usable.
- [ ] The article title still wraps to a readable number of lines at that
      width.
- [ ] Drag the panel wide. The cards fill it and the footer buttons stay even.

### Behaviour that moved

- [ ] Type in notes. The indicator beside the title reads "Saving…" then
      "✓ Saved". Reload; the text is there.
- [ ] Select text in the article and click Capture. The quote lands.
- [ ] Click Capture with nothing selected. The message appears under the
      button, in the Quotes heading, not at the foot of the panel.
- [ ] Write a comment on a quote, then remove the quote with its trash icon.
      The confirmation names the quote.
- [ ] Add a tag and remove it. The suggestion list still drops down, and the
      count beside the Tags heading follows.
- [ ] Export Markdown from the footer. The file lands and the message appears
      across the full width beneath the buttons.
- [ ] Click Open the board. The board opens or focuses as before.
- [ ] Delete card sits on its own quiet row beneath the other two.

### Empty and error states

- [ ] Open the side panel with no article behind it. The prompt sits on the
      same parchment background, centred, not on a white page.
- [ ] Open the panel on a page that is not a Substack article. The banner is
      the warning tone, not green.

### The board is unchanged

Amended 2026-09-09. The board's own detail panel is gone, so the boxes that
compared the two panels went with it.

- [ ] Open the board. Same colours, same three columns, same card faces.
- [ ] Notes, quotes, tags, export and delete all still work, now from the side
      panel a board card opens.

### Keyboard

- [ ] Tab through the panel. Every link, button, input and textarea shows an
      orange focus ring.

## 2026-09-09: board redesign

Build with `npm run build` and reload the unpacked extension from
`extension/.output/chrome-mv3` first.

The earlier sections stay ticked: they record what passed when they were run.
The board's page shell, header, tag row, columns and card faces were restyled in
this work, and the tag filter moved out of the toolbar into a row of its own.
The behaviours below are listed again here and checked against the new build.

### The look

- [ ] Open the board. It sits on the same parchment as the side panel. Columns
      are pale warm panels with a hairline border; cards are white with a
      hairline border and a soft shadow.
- [ ] Card faces show the title, `publication · author`, and the
      `notes · N quotes · exported vN` line, and nothing else. No reading-time
      line, no tag chips, no quote preview, no "Open Panel" link. (A watch or
      listen card also shows its medium word.)
- [ ] Card titles and column headers are in the system sans, not a serif.
- [ ] Column headers read `TO READ (26)` and the like: uppercase, muted, no
      dot, no badge, no subtitle, no rule over the Reading column.
- [ ] In the header, Import Saved Articles is the solid orange button;
      Export Notes, Back Up Library and Restore Backup are a quiet
      hairline-bordered cluster.
- [ ] No "Studio" pill, no "essays saved" statistics line, no ⌘K hint. There is
      no "Max minutes" field.

### The tag row

- [ ] The tag filter is its own full-width row under the header, not a strip
      inside it.
- [ ] It opens with an uppercase "TAGS:" label and a tag glyph.
- [ ] Each tag pill shows a count, e.g. `building 8`, over every card on the
      board. The count does not change when you filter.
- [ ] No "All" pill, no "Reset Filter" link, no "+ New" pill.
- [ ] On a board with no tags there is no row at all, and the board fills the
      space.

### Fluid width and the real second row

- [ ] Add tags to cards until the row fills. It wraps to a second line; the
      board still reaches the bottom of the window and scrolls inside its own
      area.
- [ ] Keep adding tags. Past about a quarter of the window the row stops
      growing and scrolls vertically; the board is still fully reachable.
- [ ] Narrow and widen the window. No horizontal scrollbar on the page.

### Behaviour unchanged

- [ ] Search narrows the board.
- [ ] Click one tag: only cards carrying it remain. Click a second: only cards
      carrying both. Click a selected tag: it clears.
- [ ] Drag a card between columns and within a column; reload; it holds.
      Keyboard drag (Tab, Space, arrows, Space) still moves a card.
- [ ] Click a card: Chrome's side panel opens on it. Notes, quotes, tags,
      export and delete all work.
- [ ] Export Notes, Back Up Library and Restore Backup all still work and report
      their counts.
- [ ] Import Saved Articles still runs and reports.

### The side panel is unchanged

- [ ] Open a Substack article and click the toolbar button. The side panel is
      the same parchment column of white cards, serif title, orange rule over
      the header card, footer that does not scroll away.
- [ ] Open a card from the board. It wears exactly the same design: there is
      only one panel now, and how it was opened does not change how it looks.

### Keyboard and focus ring

- [ ] Tab through the header, the tag row and a card. Every button, link,
      input and textarea shows an orange focus ring.

## 2026-09-09: one panel

The board's own card panel is deleted. A card on the board opens Chrome's side
panel, which is the same panel the toolbar button opens on an article. Two
panels can no longer be on screen at once.

Boxes in older dated sections that name "the board's detail panel" are records
of a panel that no longer exists. They are left as they were run.

### The gesture

Run this first. `sidePanel.open()` is honoured only inside the click that asked
for it, and no test can see this failing.

- [ ] Click a card on the board. Chrome's side panel opens.
- [ ] It shows the card you clicked, not a different one.
- [ ] No error appears above the board, and the service worker console at
      `chrome://extensions` shows no gesture complaint.
- [ ] Drag a card between columns. It still drags, and dragging does not open
      the panel.

### One panel, one card

- [ ] Click a second card. The panel switches to it.
- [ ] At no point during the switch is the first card's title, notes or quotes
      visible under the second card's state.
- [ ] With an article's panel already open from the toolbar, click a board
      card. The panel switches to that card.
- [ ] The clicked card keeps its orange outline on the board.

### What a board card's panel does not show

- [ ] No banner. There is no "Added to To Read." above the title.
- [ ] Capture is visible but greyed, and hovering it explains why.
- [ ] Press Capture anyway. Nothing is captured and nothing breaks.

### The footer

- [ ] Export Markdown, Open the board, and Delete card all appear, whether the
      panel was opened from the board or from the toolbar button.
- [ ] Delete card sits on its own row beneath the other two, and reads as quiet
      rather than as a third primary button.
- [ ] Narrow the panel to its minimum. The three buttons still fit.

### Delete

- [ ] Delete card from a board-opened panel. The confirmation names the card.
- [ ] Cancel. The card stays on the board and in the panel.
- [ ] Confirm. The tile leaves the board, its outline goes, and the panel says
      "That card is no longer on your board."
- [ ] Open the board from that panel. It opens or focuses.
- [ ] Delete card from a toolbar-captured panel. Same behaviour.

### The board without its panel

- [ ] The board fills the tab width. No column is reserved on the right.
- [ ] Export all, Export JSON, Restore JSON and Sync Saved all still work.

### Capture still works from the toolbar

- [ ] Open a Substack article, click the toolbar button, select text, click
      Capture. The quote lands.
- [ ] The banner still reports "Added to To Read." or the refreshed message.

## 2026-09-09: the missing URL and a sleeping button

> The "Open the board sleeps" boxes below were superseded on 2026-09-09 by the
> "Two buttons that would not wake up" section at the end of this file. The
> button no longer sleeps. Do not run them.


### The URL survives a long card

- [ ] Open the panel on a card with enough notes and quotes that the body
      scrolls. The source URL is still there under the byline, not clipped off
      the bottom of the header card.
- [ ] Drag the panel narrow. The URL truncates with an ellipsis on one line and
      does not disappear.
- [ ] Open the panel on a short card. Nothing about the header moved.

### Open the board sleeps while the board is open

- [ ] With no board tab open, the footer's "Open the board" is orange and works.
- [ ] With the board open, the button is grey and does nothing. Hovering it says
      "The board is already open."
- [ ] Close the board tab while the panel stays open. The button turns orange
      again without the panel being reopened.
- [ ] Click a card on the board to open the panel. The button is grey, because
      the board that was just clicked is still open.
- [ ] Open the board, then open a second window and open the panel there. The
      button is grey in both. The board is one tab, not one per window.

## 2026-09-09: two buttons that would not wake up

Run these against a freshly loaded build. Reload the unpacked extension after
building: the manifest changed, and Chrome will not notice a new
`optional_host_permissions` line otherwise.

### Open the board never sleeps

> Superseded on 2026-09-10. The button greys again, but only while the board is
> the focused tab, not merely open. Run the "2026-09-10" section below instead.

- [ ] With no board tab open, the footer's "Open the board" is orange. Click it.
      A board tab opens.
- [ ] With that board still open, click "Open the board" again. The existing
      board tab is focused. No second board tab appears.
- [ ] Click a card on the board to open the panel. "Open the board" is orange,
      not grey. Click it. The board tab you came from is focused.
- [ ] Open an article, click the toolbar button, and check the panel's
      "Open the board". It is orange whether or not a board tab exists.
- [ ] Close the board tab, then click "Open the board". A new board tab opens.

### Capture on a publication you have not granted

Use a publication whose articles you have never granted, and check
`chrome://extensions` → Substack Library → "Site access" to be sure.

- [ ] Open the board, click a card, then follow the card's link to the article
      in the same window.
- [ ] The panel's Capture button is grey, and beside it sits an outlined
      "Allow on <host>" button naming the publication's host.
- [ ] Click it. Chrome asks to let Substack Library read that site.
- [ ] Cancel. The panel is unchanged and the "Allow on" button is still there.
- [ ] Click it again and allow. **Without touching the panel**, Capture turns
      orange within a second. The "Allow on" button is gone.
- [ ] Select text in the article and click Capture. The quote lands on the card.
- [ ] Reload the panel. Capture is still orange. The grant is remembered.

### Capture follows the tab, not the opening

- [ ] With that publication granted, switch the article tab to another page.
      Capture goes grey and says "Open the article first."
- [ ] Go back to the article. Capture turns orange again.
- [ ] Open the same article in a second tab in the same window. Capture stays
      orange. Select text in the second tab and capture. The quote lands.
- [ ] Open the article in a DIFFERENT window from the one holding the panel.
      Capture is grey. The panel reads its own window only.

### The toolbar path did not regress

- [ ] On a publication you have NOT granted, open an article and click the
      toolbar button. The panel opens, the banner reports the outcome, and
      Capture is orange with no "Allow on" button. `activeTab` covers it.
- [ ] Select text and capture. The quote lands.
- [ ] Navigate that tab away and back to the article. Capture reports
      "Lost access to the article. Open it again, then capture." on a click.

### A card that cannot be asked for

- [ ] Find or make a card whose URL is not http or https. Its panel shows
      Capture grey with "Open the article first." and no "Allow on" button.
      There is no origin to ask for.

## 2026-09-10: toolbar cleanup, tooltips, and "Open the board" greying

Run against a freshly built and reloaded extension.

### Max minutes and the card reading-time are gone

- [ ] The board header has a search box and nothing else where "Max minutes"
      used to be. Search still narrows the board and still composes with the tag
      row and Export Notes.
- [ ] No card face shows an "N min" / "— min" line. A watch or listen card
      still shows its medium word; an article card shows no such line at all.
- [ ] A card exported to Markdown still carries its `reading_minutes` when one
      was found, and the side panel editor header still shows "N min read".

### The renamed toolbar buttons

- [ ] The orange primary button reads "Import Saved Articles". Click it:
      a Substack Saved tab opens, scrolls, and the board reports counts. While it
      runs the label reads "Importing…".
- [ ] The secondary cluster reads "Export Notes", "Back Up Library",
      "Restore Backup".
- [ ] Export Notes downloads the filtered board as one Markdown file. Back Up
      Library downloads every card as JSON. Restore Backup opens a file picker
      and, on a valid file, asks to confirm before it writes.
- [ ] The header still fits: with a narrow window the cluster wraps to a second
      line rather than spilling off the edge. No horizontal page scrollbar.

### Tooltips

- [ ] Hover each of the four toolbar buttons. After a moment a native tooltip
      appears describing what the button does.
- [ ] Hover Export Notes with the board filtered to nothing. The tooltip reads
      "No cards to export." and the button is disabled.

### Open the board greys only on the board

- [ ] Open a Substack article, click the toolbar button. With the article tab
      focused, the panel's "Open the board" is orange. Click it; a board tab
      opens or is focused.
- [ ] Click a card on the board. The panel opens and, because the board is now
      the focused tab, "Open the board" is grey and unclickable. Hovering it
      says "You're on the board."
- [ ] Switch to any other tab in that window. "Open the board" turns orange
      again within a moment, with no panel reload.
- [ ] Close the board tab. "Open the board" is orange, and a click opens a new
      board tab.
