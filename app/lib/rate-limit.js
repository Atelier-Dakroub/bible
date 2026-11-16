// How much one visitor may ask of the hosted site (worker.js), through
// Cloudflare's Rate Limiting binding (LIMITER in wrangler.jsonc): 600 units
// a minute for each address, in each Cloudflare location. A page, a card or
// a guide is one unit; a search, which reads the whole index, is five. A
// reader opening a table of forty cards uses forty; a script that walks the
// site stops at about ten requests a second.
//
// The counts are Cloudflare's, kept near each location and a little loose,
// so this stops floods, not one request too many. Where there is no binding
// (Node, the dev server) or it fails, every request goes on.

/** What one search costs, in units: it reads the whole index. */
export const SEARCH_WEIGHT = 5;

/**
 * @typedef {{ limit: (options: { key: string, delta?: number }) => Promise<{ success: boolean }> }} Limiter
 */

/**
 * The units a request costs.
 *
 * @param {string} pathname
 */
export function weightOf(pathname) {
  return pathname === '/search' ? SEARCH_WEIGHT : 1;
}

/**
 * The answer to a request over the limit, or null to let it go on.
 *
 * @param {Request} request
 * @param {Limiter | undefined} limiter
 * @returns {Promise<Response | null>}
 */
export async function overLimit(request, limiter) {
  if (!limiter) return null;
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await limiter.limit({ key, delta: weightOf(new URL(request.url).pathname) }).catch(() => ({ success: true }));
  if (success) return null;
  return new Response('Too many requests. Wait a minute, then try again.', {
    status: 429,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60', 'Cache-Control': 'no-store' },
  });
}
