import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { allCards } from '../db/cards';
import { visibleCards, type CardFilter } from '../domain/card';
import { allTags } from '../domain/tags';
import Board from './Board';
import Toolbar from './Toolbar';
import DetailPanel from './DetailPanel';
import AddByUrlForm from './AddByUrlForm';
import BackupControls from './BackupControls';
import SyncButton from './SyncButton';
import ExportAllButton from './ExportAllButton';

export default function App() {
  const cards = useLiveQuery(() => allCards(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>({ query: '', maxMinutes: null, tags: [] });

  const shown = cards ? visibleCards(cards, filter) : [];
  // App already holds every card for the board, so the toolbar's vocabulary is
  // free here. Toolbar stays presentational and runs no query of its own.
  const vocabulary = allTags(cards ?? []);
  const selected = cards?.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Toolbar filter={filter} onFilterChange={setFilter} tags={vocabulary}>
        <AddByUrlForm />
        <SyncButton />
        <ExportAllButton cards={shown} />
        <BackupControls />
      </Toolbar>
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
    </>
  );
}