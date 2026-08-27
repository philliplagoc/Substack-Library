/**
 * Reduce a URL to the one form the board stores and dedups on.
 * Returns null for anything that is not an http or https URL. Never throws.
 */

export function canonicalizeUrl(raw: string): string | null {
    if(typeof raw !== 'string' || raw.trim() === '') return null;

    let parsed: URL;
    try {
        parsed = new URL(raw.trim());
    } catch {
        return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    parsed.hash = '';
    parsed.search = '';

    const out = parsed.toString();
    if (parsed.pathname !== '/' && out.endsWith('/')) return out.slice(0, -1);
    return out;
}