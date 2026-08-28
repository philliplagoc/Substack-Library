import type { Card, Status } from './types';

export interface BackupFile {
  version: 1;
  exportedAt: string;
  cards: Card[];
}

const STATUSES: Status[] = ['to_read', 'reading', 'processed'];

export function toBackup(cards: Card[], exportedAt: string): BackupFile {
  return { version: 1, exportedAt, cards };
}

/**
 * Read a backup file. Keep every record that is a whole card. Report every
 * record that is not, by its position in the file.
 *
 * It never throws and it never drops a record without saying so.
 */
export function fromBackup(raw: string): { cards: Card[]; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { cards: [], errors: ['The file is not readable JSON.'] };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { cards: [], errors: ['The file does not hold a backup object.'] };
  }

  const file = parsed as Partial<BackupFile>;

  if (file.version !== 1) {
    return { cards: [], errors: [`Unknown backup version: ${String(file.version)}.`] };
  }
  if (!Array.isArray(file.cards)) {
    return { cards: [], errors: ['The file holds no cards array.'] };
  }

  const cards: Card[] = [];
  const errors: string[] = [];

  file.cards.forEach((record: unknown, index: number) => {
    const problem = describeProblem(record);
    if (problem) errors.push(`Record ${index}: ${problem}`);
    else cards.push(record as Card);
  });

  return { cards, errors };
}

function describeProblem(record: unknown): string | null {
  if (typeof record !== 'object' || record === null) return 'not an object.';
  const c = record as Record<string, unknown>;

  const str = (k: string) => typeof c[k] === 'string';
  const num = (k: string) => typeof c[k] === 'number';

  if (!str('id') || (c.id as string).trim() === '') return 'missing id.';
  if (!str('url') || (c.url as string).trim() === '') return 'missing url.';
  if (!STATUSES.includes(c.status as Status)) return `unknown status ${String(c.status)}.`;
  if (!str('title')) return 'missing title.';
  if (!str('notes')) return 'missing notes.';
  if (!str('savedAt')) return 'missing savedAt.';
  if (!num('exportVersion')) return 'missing exportVersion.';
  if (!num('sortOrder')) return 'missing sortOrder.';
  if (!Array.isArray(c.tags)) return 'tags is not an array.';
  if (!Array.isArray(c.quotes)) return 'quotes is not an array.';
  return null;
}