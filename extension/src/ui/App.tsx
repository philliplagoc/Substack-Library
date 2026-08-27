import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { allCards } from '../db/cards';
import Board from './Board';

export default function App() {
  const cards = useLiveQuery(() => allCards(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <header className="toolbar">
        <h1>Substack Library</h1>
      </header>
      <main className="layout">
        {cards === undefined ? (
          <section className="board">
            <p>Loading…</p>
          </section>
        ) : (
          <Board cards={cards} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </main>
    </>
  );
}