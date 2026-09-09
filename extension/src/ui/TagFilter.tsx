import type { CardFilter } from '../domain/card';
import { TagIcon } from './icons';

interface Props {
  filter: CardFilter;
  onFilterChange: (filter: CardFilter) => void;
  /** Every tag in use. The row is not rendered when this is empty. */
  tags: string[];
  /** Tag -> how many cards carry it, over every card on the board. */
  counts: Map<string, number>;
}

/**
 * The board's tag filter, as its own full-width row under the toolbar.
 *
 * It used to be a sideways-scrolling strip crammed into the toolbar, because the
 * toolbar had a fixed height and the layout was sized against it. The board is a
 * column-flex shell now, so a row that wraps to two lines shrinks the board area
 * instead of pushing its bottom off the screen.
 */
export default function TagFilter({ filter, onFilterChange, tags, counts }: Props) {
  if (tags.length === 0) return null;

  function toggle(tag: string) {
    const on = filter.tags.includes(tag);
    onFilterChange({
      ...filter,
      tags: on ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag],
    });
  }

  return (
    <div className="tag-filter">
      {/* CSS uppercases the label, so a screen reader still hears "Tags". */}
      <span className="tag-filter-label">
        <TagIcon className="tag-filter-icon" />
        Tags:
      </span>
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
            <span className="tag-count">{counts.get(tag) ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
