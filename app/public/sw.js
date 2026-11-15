// The service worker: the table opens without a connection.
//
// Two caches:
//
//   bible-shell  what the build lists in /precache.json: the pages it
//                prerenders (the table among them), the code, the fonts, the
//                icons and the map. Filled when the worker installs, and
//                brought up to date each time the table opens (the page
//                sends 'refresh'). The pictures are left out: 15 MB, and
//                each is kept once it is shown.
//   bible-read   what the reader opened: cards, searches, studies, cross-
//                references, pictures. The newest READ_LIMIT are kept.
//
// Online, a page or a card comes from the server, and the copy in the cache
// is replaced; the cache answers only when the network fails or takes more
// than WAIT. So a reader online always sees the current server. The code and
// the fonts come from the cache first: a hashed file never changes, and the
// shell refresh replaces a font or an icon that does.
//
// Under the dev server there is no /precache.json, so the shell is never
// filled, and the worker passes every request to the network.
//
// A classic script, not a module, so that every browser with service workers
// runs it. test/sw.test.js runs it in a sandbox.

const SHELL = 'bible-shell';
const READ = 'bible-read';
const LIST = '/precache.json';
const READ_LIMIT = 1500;
const WAIT = 4000;

/**
 * How a request to this site is answered.
 *
 * @param {string} path
 * @returns {'pass' | 'cache-first' | 'network-first'}
 */
function strategyFor(path) {
  // The worker itself, the list, the recordings (large, and asked for in
  // ranges), the MCP bridge, the videos, and the dev server's own files.
  if (path === '/sw.js' || path === LIST) return 'pass';
  if (/^\/(audio|listen|api|video)(\/|$)/.test(path)) return 'pass';
  if (/^\/(@|node_modules\/|app\/|src\/)/.test(path)) return 'pass';
  if (/^\/(assets|fonts|icons|map|images)\//.test(path)) return 'cache-first';
  return 'network-first';
}

/**
 * Whether a file of the precache list goes in the shell.
 *
 * @param {string} url
 */
function inShell(url) {
  return !url.startsWith('/images/');
}

/**
 * What to fetch and what to drop, from the list in the cache and the new one.
 * A file with no revision is named by its hash, so it is fetched once; the
 * others again when their revision changes.
 *
 * @param {{ url: string, revision: string | null }[]} old
 * @param {{ url: string, revision: string | null }[]} next
 * @param {Set<string>} held the URLs in the shell now
 * @returns {{ fetch: string[], drop: string[] }}
 */
function shellPlan(old, next, held) {
  const before = new Map(old.map((entry) => [entry.url, entry.revision]));
  const wanted = next.filter((entry) => inShell(entry.url));
  const names = new Set(wanted.map((entry) => entry.url));
  return {
    fetch: wanted
      .filter((entry) => !held.has(entry.url) || (entry.revision !== null && before.get(entry.url) !== entry.revision))
      .map((entry) => entry.url),
    drop: [...held].filter((url) => !names.has(url)),
  };
}

/** Brings the shell up to the build's list. No list (the dev server): empties it. */
async function refreshShell() {
  const response = await fetch(LIST, { cache: 'no-store' }).catch(() => null);
  if (!response) return; // offline: keep what there is
  const shell = await caches.open(SHELL);
  if (!response.ok) {
    await caches.delete(SHELL);
    return;
  }
  const next = await response.json();
  const kept = await shell.match(LIST);
  const old = kept ? await kept.json() : { version: null, precache: [] };
  if (old.version === next.version) return;

  const held = new Set((await shell.keys()).map((request) => new URL(request.url).pathname).filter((path) => path !== LIST));
  const plan = shellPlan(old.precache, next.precache, held);
  const results = await Promise.all(
    plan.fetch.map(async (url) => {
      const file = await fetch(url, { cache: 'no-cache' }).catch(() => null);
      if (!file?.ok || file.redirected) return false;
      await shell.put(url, file);
      return true;
    }),
  );
  await Promise.all(plan.drop.map((url) => shell.delete(url)));
  // The list goes in last, and only when every file came: a file that did
  // not is fetched again on the next refresh.
  if (results.every(Boolean)) await shell.put(LIST, new Response(JSON.stringify(next)));
}

let filled = false;

/** Whether the shell is filled, which is what turns the worker on. */
async function ready() {
  filled ||= Boolean(await (await caches.open(SHELL)).match(LIST));
  return filled;
}

/**
 * A response that may be kept: this site's, whole, and not a redirect, which
 * a page's navigation refuses to take from a cache.
 *
 * @param {Response} response
 */
function keepable(response) {
  return response.ok && response.type === 'basic' && !response.redirected;
}

let trimming = false;

/** Drops the oldest of what the reader opened, past READ_LIMIT. */
async function trim() {
  if (trimming) return;
  trimming = true;
  try {
    const read = await caches.open(READ);
    const keys = await read.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - READ_LIMIT)).map((key) => read.delete(key)));
  } finally {
    trimming = false;
  }
}

/**
 * Keeps a copy of a response in the reader's cache.
 *
 * @param {Request} request
 * @param {Response} response
 */
async function keep(request, response) {
  if (!keepable(response)) return;
  // Copied before the first await: by then the page may have read the body.
  const copy = response.clone();
  await (await caches.open(READ)).put(request, copy);
  await trim();
}

/**
 * What answers when neither the network nor the cache can: for a page, the
 * offline page; for anything else, a 503 that the table reads as "did not
 * load", as it reads any failure.
 *
 * @param {Request} request
 */
async function unavailable(request) {
  if (request.mode === 'navigate') {
    const page = await caches.match('/offline');
    if (page) return page;
  }
  return new Response('Not available offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/**
 * The cache's copy, else the network's (kept).
 *
 * @param {FetchEvent} event
 */
async function cacheFirst(event) {
  const kept = await caches.match(event.request);
  if (kept) return kept;
  const response = await fetch(event.request).catch(() => null);
  if (!response) return unavailable(event.request);
  event.waitUntil(keep(event.request, response));
  return response;
}

/**
 * The network's answer, kept; the cache's copy when the network fails, fails
 * on the server, or is slower than WAIT.
 *
 * @param {FetchEvent} event
 */
async function networkFirst(event) {
  const { request } = event;
  const network = fetch(request).then((response) => {
    event.waitUntil(keep(request, response));
    return response;
  });
  // Not left to reject unseen when the cache answers first.
  network.catch(() => {});

  /** @type {Promise<null>} */
  const late = new Promise((resolve) => setTimeout(resolve, WAIT, null));
  const first = await Promise.race([network.catch(() => null), late]);
  if (first && first.status < 500) return first;

  // A page's address may carry a query (/table?ui=m); its copy is the page's.
  const kept = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
  if (kept) return kept;
  if (first) return first;
  // Slow, and nothing kept: wait for the network after all.
  const response = await network.catch(() => null);
  return response ?? unavailable(request);
}

self.addEventListener('install', (event) => {
  // In use at once, as nothing here depends on the pages being of one build.
  /** @type {any} */ (self).skipWaiting();
  /** @type {any} */ (event).waitUntil(refreshShell());
});

self.addEventListener('activate', (event) => {
  /** @type {any} */ (event).waitUntil(/** @type {any} */ (self).clients.claim());
});

self.addEventListener('message', (event) => {
  if (/** @type {MessageEvent} */ (event).data === 'refresh') /** @type {any} */ (event).waitUntil(refreshShell());
});

self.addEventListener('fetch', (event) => {
  const fetchEvent = /** @type {FetchEvent} */ (event);
  const { request } = fetchEvent;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  const how = strategyFor(url.pathname);
  if (how === 'pass') return;
  fetchEvent.respondWith(
    ready().then((on) => {
      if (!on) return fetch(request);
      return how === 'cache-first' ? cacheFirst(fetchEvent) : networkFirst(fetchEvent);
    }),
  );
});
