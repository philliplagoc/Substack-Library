# Layout decisions from the Milestone 0 prototype

Milestone 1 follows these. Change them here first, then in code.

## Board

- Column layout: three equal columns in a CSS grid.
  - Choice: Keep as currently implemented.
  - Reason: It all resizes correctly.
- Card fields and order: title, publication · author, minutes + saved date, status line.
  - Choice: Remove saved date 
  - Reason: It's a good amount of info to show, but I think the saved date isn't necessary.
- Card with no reading-time estimate when a max-minutes filter is set: hide or show?
  - Choice: hide
  - Reason: I only want to see articles that pass the filter.
- Minimum window width before columns stack or scroll: ?
  - Choice: Keep as currently implemented.
  - Reason: It looks fine right now.

## Panel

- Panel placement: right side, fixed width.
  - Choice: Keep as currently implemented.
  - Reason: It looks fine.
- Panel sections and order: title, meta, notes, quotes, markdown preview.
  - Choice: Keep as currently implemented.
  - Reason: Looks good
- Markdown preview: always visible, or behind a toggle?
  - Choice: Behind a toggle.
  - Reason: Lessen the amount of info shown.

## Drag and drop

- Native DnD had no keyboard support. dnd-kit is confirmed for Milestone 1.
- Drop position: end of column. Milestone 1 must support drop between cards.

## Open questions for Milestone 1

- 