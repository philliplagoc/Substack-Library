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
/**
 * Host labels that name a delivery channel, not a publication.
 * `newsletter.pragmaticengineer.com` is The Pragmatic Engineer, not "newsletter".
 */
const GENERIC_HOST_LABELS = new Set(['www', 'newsletter', 'blog', 'mail', 'email', 'news']);

/**
 * The publication a host belongs to, lowercased.
 *
 * Two rules pull in opposite directions, so the branch matters:
 *  - On a `*.substack.com` host the first label IS the publication, even when
 *    it reads like a generic word. `news.substack.com` is the publication
 *    "news".
 *  - On a custom domain the first label is often a delivery channel that has
 *    to come off before the real name shows.
 */
export function publicationFromHost(host: string): string {
  const labels = host.split('.');

  // On substack.com the first label is the publication, whatever it reads like.
  if (host.endsWith('.substack.com')) return labels[0]!;

  // On a custom domain, shed delivery-channel labels. Never strip past the
  // registrable domain: `name.tld` is two labels, so two is the floor.
  while (labels.length > 2 && GENERIC_HOST_LABELS.has(labels[0]!)) {
    labels.shift();
  }

  return labels[0]!;
}

/**
 * The identity of an article, independent of which URL you arrived by.
 *
 * Substack serves one article from several addresses: the publication's custom
 * domain, its `*.substack.com` subdomain, and the `open.substack.com/pub/...`
 * share route. `canonicalizeUrl` cannot fold these, because which publication
 * owns `www.pokgaigamer.com` is a fact about the world, not about the string.
 * This makes the same guess a reader makes: the name is in the host.
 *
 * A URL with no Substack article shape keys on its canonical form, so a card
 * from anywhere else still gets exactly one identity.
 *
 * Returns null for anything `canonicalizeUrl` rejects. Never throws.
 */
export function articleKey(raw: string): string | null {
  const canonical = canonicalizeUrl(raw);
  if (canonical === null) return null;

  const { hostname, pathname } = new URL(canonical);

  // The share route names its own publication, so the host says nothing.
  const shared = pathname.match(/^\/pub\/([^/]+)\/p\/([^/]+)$/);
  if (shared) return `${shared[1]!.toLowerCase()}/p/${shared[2]!.toLowerCase()}`;

  const direct = pathname.match(/^\/p\/([^/]+)$/);
  if (direct) return `${publicationFromHost(hostname)}/p/${direct[1]!.toLowerCase()}`;

  return canonical;
}

/**
 * Does this URL name a Substack article the extension should capture?
 *
 * The board wins every other URL: the toolbar button opens it instead.
 *
 * A false positive is cheap. A non-Substack page with a `/p/` path gets
 * injected, yields no Substack metadata, and says so. A false NEGATIVE is
 * expensive: the reader clicks on a real article and gets the board.
 */
export function shouldCaptureFrom(rawUrl: string | undefined | null): boolean {
  // Narrow the type so canonicalizeUrl, which takes a plain string, accepts it.
  if (typeof rawUrl !== 'string') return false;

  // Not an http or https page at all: the board wins.
  const canonical = canonicalizeUrl(rawUrl);
  if (canonical === null) return false;

  const { pathname } = new URL(canonical);

  // The two path shapes Substack serves an article from. Anchored at both ends
  // so `/inbox/saved` and its neighbours cannot match on a suffix.
  const direct = /^\/p\/[^/]+$/;
  const shared = /^\/pub\/[^/]+\/p\/[^/]+$/;

  return direct.test(pathname) || shared.test(pathname);
}
