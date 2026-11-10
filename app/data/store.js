// Where the data files come from.
//
// The data (about 60 MB of JSON in app/data) is too large to go into a
// Cloudflare Worker, whose code has a limit of 10 MB. So it is not imported:
// it is read when it is needed, by its name in app/data, such as
// 'kjv/GEN.json'.
//
//   On Node (npm run dev, npm start, the tests, the MCP server) a name is a
//   file in app/data.
//   On Cloudflare the deploy puts the files in the Worker's static assets,
//   under /data (tools/build-edge.js), and worker.js gives this module the
//   assets binding as globalThis.bibleAssets.
//
// A Worker also has 128 MB of memory, and the whole Hebrew and Greek text
// alone takes more than that when it is parsed. So on Cloudflare a cache made
// with shelf() keeps only its most recently used books. On Node it keeps all.

/** @typedef {{ fetch: (request: Request) => Promise<Response> }} Assets */

const WORKER = globalThis.navigator?.userAgent === 'Cloudflare-Workers';

/** The folder that holds the data, on Node. */
function folder() {
  const here = new URL('./', import.meta.url);
  // Run from source, this file is in app/data. Bundled by the build, it is
  // somewhere in dist, and the app runs from the project's root.
  if (here.protocol === 'file:' && here.pathname.endsWith('/app/data/')) return decodeURIComponent(here.pathname);
  return `${globalThis.process?.cwd?.() ?? '.'}/app/data/`;
}

/**
 * A data file, parsed.
 *
 * @param {string} name its path in app/data, such as 'kjv/GEN.json'
 * @returns {Promise<any>}
 */
export async function load(name) {
  /** @type {Assets | undefined} */
  const assets = /** @type {any} */ (globalThis).bibleAssets;
  if (assets) {
    const response = await assets.fetch(new Request(`https://assets.local/data/${name}`));
    if (!response.ok) throw new Error(`No data file ${name} (${response.status}).`);
    return response.json();
  }
  // Not imported, so that no bundler follows it into the Worker.
  /** @type {typeof import('node:fs/promises')} */
  const fs = /** @type {any} */ (globalThis).process.getBuiltinModule('node:fs/promises');
  return JSON.parse(await fs.readFile(`${folder()}${name}`, 'utf8'));
}

/**
 * A data file, or `fallback` when there is no such file: a book that has no
 * cross-references, say.
 *
 * @template T
 * @param {string} name
 * @param {T} fallback
 * @returns {Promise<any>}
 */
export function loadOr(name, fallback) {
  return load(name).catch(() => fallback);
}

/**
 * A cache of promises by key. On Cloudflare it keeps the `limit` most
 * recently used; on Node it keeps all.
 *
 * @param {number} limit
 * @returns {<T>(key: string, make: () => Promise<T>) => Promise<T>}
 */
export function shelf(limit) {
  const most = WORKER ? limit : Infinity;
  /** @type {Map<string, Promise<any>>} */
  const kept = new Map();
  return (key, make) => {
    let promise = kept.get(key);
    if (promise) {
      kept.delete(key);
    } else {
      promise = make();
      // A failed load is not kept, so the next asks again.
      promise.catch(() => kept.get(key) === promise && kept.delete(key));
    }
    kept.set(key, promise);
    while (kept.size > most) kept.delete(/** @type {string} */ (kept.keys().next().value));
    return promise;
  };
}
