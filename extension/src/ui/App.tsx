import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { allCards } from '../db/cards';
import { visibleCards, type CardFilter } from '../domain/card';
import { allTags } from '../domain/tags';
import Board from './Board';
import Toolbar from './Toolbar';
import TagFilter from './TagFilter';
import DetailPanel from './DetailPanel';
import BackupControls from './BackupControls';
import SyncButton from './SyncButton';
import ExportAllButton from './ExportAllButton';

export default function App() {
  const cards = useLiveQuery(() => allCards(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>({ query: '', maxMinutes: null, tags: [] });

  const shown = cards ? visibleCards(cards, filter) : [];
  // App already holds every card for the board, so the tag row's vocabulary is
  // free here. TagFilter stays presentational and runs no query of its own.
  const vocabulary = allTags(cards ?? []);
  const selected = cards?.find((c) => c.id === selectedId) ?? null;

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
      <main className={`layout${selected ? ' with-panel' : ''}`}>
        {cards === undefined ? (
          <section className="board">
            <p>Loading…</p>
          </section>
        ) : (
          <Board cards={shown} selectedId={selectedId} onSelect={setSelectedId} />
        )}
        {selected ? <DetailPanel card={selected} onClose={() => setSelectedId(null)} /> : null}
      </main>
    </div>
  );
}