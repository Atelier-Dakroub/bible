// The app's data files, read when they are needed rather than built into the
// server's code.
//
// Under Node (npm run dev, npm start, the tests), a file is read from
// app/data on the disk; BIBLE_DATA moves the folder. On Cloudflare there is
// no disk: tools/edge-data.js links app/data into dist/edge/data, the edge
// serves that folder, and a file is fetched through the worker's ASSETS
// binding. worker.js puts the worker's env where this file finds it (hold).
//
// Built into the code, the data made the Worker about 300 MB, and Cloudflare
// takes 64 MiB at most. Read like this, it is in the Worker only once a
// request needs it, and each file is read once per Worker.

/** Node's file system, where the app runs under Node; null on Cloudflare. */
/** @type {any} */
const files = /** @type {any} */ (globalThis).process?.getBuiltinModule?.('node:fs/promises') ?? null;
/** @type {string} */
const ROOT = /** @type {any} */ (globalThis).process?.env?.BIBLE_DATA || 'app/data';
/** Where worker.js keeps the env, in the global registry, as two bundles may hold this file. */
const SLOT = Symbol.for('bible.env');

/**
 * Keeps the worker's env for the data reads of this request and later ones.
 *
 * @param {{ ASSETS?: { fetch: (request: Request) => Promise<Response> } }} env
 */
export function hold(env) {
  /** @type {any} */ (globalThis)[SLOT] = env;
}

/**
 * A data file's text, from the disk or from the edge.
 *
 * @param {string} path relative to app/data, such as bsb/GEN.json
 * @returns {Promise<string>}
 */
async function textOf(path) {
  // The binding first: workerd has a `node:fs` too, but it holds only the
  // worker's own code, so a worker that reads app/data from it finds nothing.
  const assets = /** @type {any} */ (globalThis)[SLOT]?.ASSETS;
  if (assets) return fromEdge(assets, path);
  if (files) return files.readFile(`${ROOT}/${path}`, 'utf8');
  throw new Error(`No data here for ${path}: on Cloudflare, worker.js must hold an env with an ASSETS binding.`);
}

/**
 * A data file's text from the edge, through the worker's ASSETS binding.
 *
 * @param {{ fetch: (request: Request) => Promise<Response> }} assets
 * @param {string} path
 */
async function fromEdge(assets, path) {
  // The host is never looked up: the binding answers from the edge's files.
  const response = await assets.fetch(new Request(`https://assets.invalid/data/${path}`));
  if (!response.ok) throw new Error(`No data file ${path} on the edge (${response.status}).`);
  return response.text();
}

/** @type {Map<string, Promise<any>>} each file, read once */
const read = new Map();

/**
 * A data file, parsed. A file that fails to read is tried again next time.
 *
 * @param {string} path relative to app/data
 * @returns {Promise<any>}
 */
export function readJson(path) {
  let found = read.get(path);
  if (!found) {
    found = textOf(path).then((text) => JSON.parse(text));
    found.catch(() => read.delete(path));
    read.set(path, found);
  }
  return found;
}

/**
 * A data file in the shape of a JSON module (`{ default }`), so that code
 * written for `import('./x.json')` reads it unchanged.
 *
 * @param {string} path relative to app/data
 * @returns {Promise<{ default: any }>}
 */
export function json(path) {
  return readJson(path).then((data) => ({ default: data }));
}
