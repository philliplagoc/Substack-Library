import type { ReactNode } from 'react';
import type { CardFilter } from '../domain/card';

interface Props {
  filter: CardFilter;
  onFilterChange: (filter: CardFilter) => void;
  /** Every tag in use. The strip is not rendered when this is empty. */
  tags: string[];
  children?: ReactNode;
}

export default function Toolbar({ filter, onFilterChange, tags, children }: Props) {
  function toggle(tag: string) {
    const on = filter.tags.includes(tag);
    onFilterChange({
      ...filter,
      tags: on ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag],
    });
  }

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
      {/* Hidden entirely on a board with no tags. An empty row of buttons above
          an empty board is furniture that teaches nothing. */}
      {tags.length > 0 ? (
        <div className="tag-filter">
          {tags.map((tag) => {
            const on = filter.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                className={on ? 'tag on' : 'tag'}
                onClick={() => toggle(tag)}
              >
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}
      {children}
    </header>
  );
}
