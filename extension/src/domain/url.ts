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
 * The URL to store for an article, given the address bar and the canonical
 * link the page declares.
 *
 * A fresh canonical is worth preferring. On the `open.substack.com/pub/...`
 * share route it names the publication's own address instead, which is the one
 * a reader wants to open later.
 *
 * A canonical cannot be assumed fresh. Substack is a React SPA, and
 * `<link rel="canonical">` is server-rendered rather than react-helmet managed
 * — `og:title` carries `data-rh="true"` and the canonical does not. A
 * client-side navigation into an article therefore swaps the title and leaves
 * the PREVIOUS page's canonical in the head. Measured on
 * `www.theworkthatholds.com` on 2026-08-30: the address bar read
 * `/p/stop-posting-random-thoughts` while canonical and og:url both still read
 * `https://www.theworkthatholds.com/`.
 *
 * The address bar cannot go stale, because the browser owns it and the page
 * does not. So it is the floor: the canonical only wins when it agrees with
 * the address bar about which article this is.
 */
export function resolveArticleUrl(
  tabUrl: string,
  canonicalUrl: string | null | undefined,
): string {
  if (typeof canonicalUrl !== 'string') return tabUrl;

  const canonical = canonicalizeUrl(canonicalUrl);
  if (canonical === null) return tabUrl;

  // Same publication and same slug, or the address bar wins. `articleKey`
  // reads the publication out of the host, so a canonical pointing at the
  // publication's OTHER domain counts as a different article and loses. That
  // costs the nicer host in a case Substack already makes rare, because a
  // publication with a custom domain redirects its `*.substack.com` address to
  // it. Storing a URL from the wrong publication is the expensive mistake.
  return articleKey(canonical) === articleKey(tabUrl) ? canonical : tabUrl;
}

/**
 * Does this URL name a Substack article the extension should capture?
 *
 * The board wins every other URL: the toolbar button opens it instead.
 *
 * A false positive is cheap. A non-Substack page with a `/p/` path gets
 * injected, yields no Substack metadata, and says so. A false NEGATIVE is
 * expensive: the reader clicks on a real article and gets the board.
 *
 * The inbox reader route is the exception to "a false positive is cheap". It
 * serves a real og:title belonging to the app shell, so a wrong answer arrives
 * looking like a right one. `capture()` carries the guard: when the article's
 * own URL cannot be read out of the body, it refuses out loud.
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

  return direct.test(pathname) || shared.test(pathname) || isReaderRoute(canonical);
}

/**
 * Is this the Substack app reading a post, rather than an article's own page?
 *
 * `substack.com/inbox/post/<id>` and `substack.com/home/post/<id>` draw a post
 * inside the app shell. The server matched `/inbox` or `/home`, so `<head>`
 * describes the shell and every head-first read path in `extract.ts` answers
 * for the wrong page. A caller that sees true must read the article's identity
 * out of the body instead.
 *
 * The host is part of the rule. No publication serves `/inbox/post/<id>` from
 * its own domain, so matching the path alone would widen this for nothing.
 *
 * The id comes in two shapes. The inbox writes bare digits, `213391431`; the
 * home feed writes `p-175437103`. Both are matched, and neither is loosened to
 * "any segment": `/inbox/post/settings` is a settings page, not a post, and a
 * capture attempt there would inject into a page with no article to find.
 *
 * A third path reaches the same shell: `substack.com/@<handle>/p-<id>`, the
 * profile-scoped link. Same rule — the leading segment is `@<handle>` instead
 * of `inbox/post` or `home/post`, and the id still ends the path.
 */
// Matches `/inbox/post/<id>`, `/home/post/p-<id>`, and `/@<handle>/p-<id>`.
// The id is always `(?:p-)?\d+` and always ends the path; only the leading
// segment differs. Anchored at both ends so a settings or about page under the
// same prefix cannot match. The handle is `[\w-]+`: Substack handles are
// alphanumerics, underscores, and hyphens, and the trailing `\d+$` already
// blocks `/@handle/about` on its own.
const READER_PATH = /^\/(?:(?:inbox|home)\/post|@[\w-]+)\/(?:p-)?\d+$/;

export function isReaderRoute(rawUrl: string | undefined | null): boolean {
  if (typeof rawUrl !== 'string') return false;

  const canonical = canonicalizeUrl(rawUrl);
  if (canonical === null) return false;

  const { hostname, pathname } = new URL(canonical);
  return hostname === 'substack.com' && READER_PATH.test(pathname);
}

/**
 * The host permission an article needs, and the host to name when asking for
 * it.
 *
 * A match pattern over one origin, not one URL: the reader grants "this
 * publication" once and every article on it works, which is the grain a reader
 * thinks in. Returns null for anything `canonicalizeUrl` rejects. Never throws.
 */
export function originPattern(raw: string): { pattern: string; host: string } | null {
  const canonical = canonicalizeUrl(raw);
  if (canonical === null) return null;

  const { origin, hostname } = new URL(canonical);
  return { pattern: `${origin}/*`, host: hostname };
}
