import type { ReactNode } from 'react';
import type { CardFilter } from '../domain/card';

interface Props {
  filter: CardFilter;
  onFilterChange: (filter: CardFilter) => void;
  children?: ReactNode;
}

export default function Toolbar({ filter, onFilterChange, children }: Props) {
  return (
    <header className="toolbar">
      <h1>Substack Library</h1>
      <input
        type="search"
        placeholder="Search title, author, publication"
        value={filter.query}
        onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
      />
      {children}
    </header>
  );
}
