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
      <label>
        Max minutes{' '}
        <input
          type="number"
          min={0}
          placeholder="any"
          value={filter.maxMinutes ?? ''}
          onChange={(e) =>
            onFilterChange({
              ...filter,
              maxMinutes: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
      </label>
      {children}
    </header>
  );
}
