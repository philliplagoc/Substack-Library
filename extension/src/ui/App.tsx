import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { allCards } from '../db/cards';
import { visibleCards, type CardFilter } from '../domain/card';
import { allTags } from '../domain/tags';
import Board from './Board';
import Toolbar from './Toolbar';
import TagFilter from './TagFilter';
import BackupControls from './BackupControls';
import SyncButton from './SyncButton';
import ExportAllButton from './ExportAllButton';
import { openCardInPanel } from './openCardInPanel';
import { useOwnTab } from './useOwnTab';

export default function App() {
  const cards = useLiveQuery(() => allCards(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>({ query: '', tags: [] });
  const [panelError, setPanelError] = useState<string | null>(null);
  const ownTab = useOwnTab();

  const shown = cards ? visibleCards(cards, filter) : [];
  // App already holds every card for the board, so the tag row's vocabulary is
  // free here. TagFilter stays presentational and runs no query of its own.
  const vocabulary = allTags(cards ?? []);

  // A count for each tag, shown on its pill in the filter row. Over every card,
  // not the filtered set, so the number reads as a property of the tag rather
  // than something that shifts as you narrow the board.
  const tagCounts = useMemo<Map<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const card of cards ?? []) {
      for (const tag of card.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }, [cards]);

  /*
   * The board no longer holds a panel of its own. A card opens the side panel,
   * the same one the toolbar button opens on an article, so there is one panel
   * in one place and never two on screen at once.
   *
   * Nothing is awaited before `openCardInPanel`. It has to run inside the
   * click's user gesture or Chrome refuses to open the panel.
   */
  function handleSelect(id: string) {
    setSelectedId(id);
    setPanelError(null);

    const card = cards?.find((c) => c.id === id);
    if (!card) return;

    void openCardInPanel(card, ownTab.current).catch(() => {
      setPanelError('Could not open the panel. Click the Substack Library toolbar button.');
    });
  }

  return (
    <div className="board-root">
      <Toolbar filter={filter} onFilterChange={setFilter}>
        <SyncButton />
        <ExportAllButton cards={shown} />
        <BackupControls />
      </Toolbar>
      <TagFilter
        filter={filter}
        onFilterChange={setFilter}
        tags={vocabulary}
        counts={tagCounts}
      />
      {panelError ? <p className="notice error panel-error">{panelError}</p> : null}
      <main className="layout">
        {cards === undefined ? (
          <section className="board">
            <p>Loading…</p>
          </section>
        ) : (
          <Board cards={shown} selectedId={selectedId} onSelect={handleSelect} />
        )}
      </main>
    </div>
  );
}
