import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { allCards } from '../db/cards';
import { visibleCards, type CardFilter } from '../domain/card';
import Board from './Board';
import Toolbar from './Toolbar';
import DetailPanel from './DetailPanel';
import AddByUrlForm from './AddByUrlForm';
import BackupControls from './BackupControls';
import SyncButton from './SyncButton';

export default function App() {
  const cards = useLiveQuery(() => allCards(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>({ query: '', maxMinutes: null });

  const shown = cards ? visibleCards(cards, filter) : [];
  const selected = cards?.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Toolbar filter={filter} onFilterChange={setFilter}>
        <AddByUrlForm />
        <SyncButton />
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