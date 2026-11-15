// public/sw.js, run in a sandbox: a fake network and fake caches, and the
// worker's own events. What it must do: fill the shell from /precache.json,
// answer from the server while online and keep a copy, answer from the copy
// offline, and step aside where there is no list (the dev server).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../app/public/sw.js', import.meta.url));
const SOURCE = readFileSync(FILE, 'utf8');
const ORIGIN = 'https://bible.test';

/** A Cache: URL to response, in the order put, as the platform keeps it. */
class FakeCache {
  /** @type {Map<string, Response>} */
  store = new Map();

  /** @param {Request | string} key */
  static url(key) {
    return new URL(typeof key === 'string' ? key : key.url, ORIGIN).href;
  }

  /** @param {Request | string} key @param {{ ignoreSearch?: boolean }} [options] */
  async match(key, options = {}) {
    const url = FakeCache.url(key);
    const found = this.store.get(url) ?? (options.ignoreSearch ? this.store.get(url.split('?')[0]) : undefined);
    return found?.clone();
  }

  /** @param {Request | string} key @param {Response} response */
  async put(key, response) {
    const url = FakeCache.url(key);
    this.store.delete(url);
    this.store.set(url, response);
  }

  /** @param {Request | string} key */
  async delete(key) {
    return this.store.delete(FakeCache.url(key));
  }

  async keys() {
    return [...this.store.keys()].map((url) => new Request(url));
  }
}

/**
 * The worker in a sandbox.
 *
 * @param {Record<string, string | number>} server path to body, or to a status
 */
function sandbox(server) {
  /** @type {Map<string, FakeCache>} */
  const named = new Map();
  const caches = {
    /** @param {string} name */
    async open(name) {
      // A turn of the event loop, as the disk takes: a copy made after this
      // finds the body already read.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!named.has(name)) named.set(name, new FakeCache());
      return /** @type {FakeCache} */ (named.get(name));
    },
    /** @param {string} name */
    async delete(name) {
      return named.delete(name);
    },
    /** @param {Request | string} key @param {{ ignoreSearch?: boolean }} [options] */
    async match(key, options) {
      for (const cache of named.values()) {
        const found = await cache.match(key, options);
        if (found) return found;
      }
      return undefined;
    },
  };

  const net = { online: true, asked: /** @type {string[]} */ ([]) };
  /** @param {Request | string} input */
  async function fetch(input) {
    const url = new URL(typeof input === 'string' ? input : input.url, ORIGIN);
    const path = url.pathname + url.search;
    net.asked.push(path);
    if (!net.online) throw new TypeError('Failed to fetch');
    const body = server[path] ?? server[url.pathname];
    if (body === undefined) return response(404, 'not found', url.href);
    if (typeof body === 'number') return response(body, '', url.href);
    return response(200, body, url.href);
  }

  /** @type {Record<string, Function>} */
  const handlers = {};
  const self = {
    /** @param {string} type @param {Function} handler */
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    skipWaiting() {},
    clients: { claim: async () => {} },
  };
  // Named by its path, so that coverage (tools/crap.js) counts these runs.
  vm.runInNewContext(SOURCE, { self, caches, fetch, location: { origin: ORIGIN }, URL, Request, Response, setTimeout, console }, { filename: FILE });

  /** @param {string} type @param {object} fields */
  async function fire(type, fields = {}) {
    /** @type {Promise<any>[]} */
    const waits = [];
    /** @type {Promise<Response> | null} */
    let answer = null;
    handlers[type]({
      ...fields,
      /** @param {Promise<any>} promise */
      waitUntil: (promise) => waits.push(promise),
      /** @param {Promise<Response>} promise */
      respondWith: (promise) => (answer = promise),
    });
    const response = answer ? await answer : null;
    // Read at once, as a page does, before the worker's copies are made.
    const read = response ? { status: response.status, body: await response.text() } : null;
    // waitUntil may be called while the answer is made.
    for (let i = 0; i < waits.length; i++) await waits[i];
    return read;
  }

  // A Request's mode cannot be made navigate; the worker only reads it.
  /** @param {string} path @param {string} mode */
  const ask = (path, mode) => fire('fetch', { request: Object.defineProperty(new Request(ORIGIN + path), 'mode', { value: mode }) });
  /** @param {string} path */
  const get = (path) => ask(path, 'cors');
  /** @param {string} path */
  const visit = (path) => ask(path, 'navigate');

  return { fire, get, visit, net, named };
}

/** @param {number} status @param {string} body @param {string} url */
function response(status, body, url) {
  const made = new Response(status === 204 ? null : body, { status });
  Object.defineProperty(made, 'url', { value: url });
  Object.defineProperty(made, 'type', { value: 'basic' });
  return made;
}

const LIST = JSON.stringify({
  version: 'one',
  precache: [
    { url: '/assets/entry-abc.js', revision: null },
    { url: '/images/picture.jpg', revision: '"p"' },
    { url: '/offline', revision: '"o"' },
    { url: '/table', revision: '"t1"' },
  ],
});

const SITE = {
  '/precache.json': LIST,
  '/assets/entry-abc.js': 'code',
  '/images/picture.jpg': 'picture',
  '/offline': 'offline page',
  '/table': 'the table',
  '/card/JHN.3.16': 'a card',
};

/** @param {{ body: string } | null} answer */
const text = (answer) => answer?.body;

test('installing fills the shell from the list, without the pictures', async () => {
  const worker = sandbox(SITE);
  await worker.fire('install');
  const shell = worker.named.get('bible-shell');
  const held = [...(shell?.store.keys() ?? [])].map((url) => new URL(url).pathname).sort();
  assert.deepEqual(held, ['/assets/entry-abc.js', '/offline', '/precache.json', '/table']);
});

test('online, a card comes from the server and a copy is kept; offline, the copy answers', async () => {
  const worker = sandbox(SITE);
  await worker.fire('install');
  assert.equal(await text(await worker.get('/card/JHN.3.16')), 'a card');

  worker.net.online = false;
  assert.equal(await text(await worker.get('/card/JHN.3.16')), 'a card');
});

test('offline, a page the device never opened shows the offline page, and a card a 503', async () => {
  const worker = sandbox(SITE);
  await worker.fire('install');
  worker.net.online = false;

  assert.equal(await text(await worker.visit('/card/GEN.1.1')), 'offline page');
  const card = await worker.get('/card/GEN.1.1?fragment=card');
  assert.equal(card?.status, 503);
});

test('offline, the table opens from the shell, with or without a query', async () => {
  const worker = sandbox(SITE);
  await worker.fire('install');
  worker.net.online = false;
  assert.equal(await text(await worker.visit('/table')), 'the table');
  assert.equal(await text(await worker.visit('/table?ui=m')), 'the table');
});

test('a hashed file comes from the cache, without asking the network', async () => {
  const worker = sandbox(SITE);
  await worker.fire('install');
  worker.net.asked.length = 0;
  assert.equal(await text(await worker.get('/assets/entry-abc.js')), 'code');
  assert.deepEqual(worker.net.asked, []);
});

test('a server error gives way to the kept copy', async () => {
  const worker = sandbox({ ...SITE });
  await worker.fire('install');
  await worker.get('/card/JHN.3.16');
  const broken = sandbox({ ...SITE, '/card/JHN.3.16': 500 });
  broken.named.set('bible-read', /** @type {FakeCache} */ (worker.named.get('bible-read')));
  broken.named.set('bible-shell', /** @type {FakeCache} */ (worker.named.get('bible-shell')));
  assert.equal(await text(await broken.get('/card/JHN.3.16')), 'a card');
});

test('a refresh fetches what changed and drops what left the list', async () => {
  const worker = sandbox(SITE);
  await worker.fire('install');

  const next = JSON.stringify({
    version: 'two',
    precache: [
      { url: '/assets/entry-def.js', revision: null },
      { url: '/offline', revision: '"o"' },
      { url: '/table', revision: '"t2"' },
    ],
  });
  const updated = sandbox({ ...SITE, '/precache.json': next, '/assets/entry-def.js': 'new code', '/table': 'the new table' });
  updated.named.set('bible-shell', /** @type {FakeCache} */ (worker.named.get('bible-shell')));
  await updated.fire('message', { data: 'refresh' });

  const shell = /** @type {FakeCache} */ (updated.named.get('bible-shell'));
  const held = [...shell.store.keys()].map((url) => new URL(url).pathname).sort();
  assert.deepEqual(held, ['/assets/entry-def.js', '/offline', '/precache.json', '/table']);
  assert.equal(await (await shell.match('/table'))?.text(), 'the new table');
  // /offline did not change, so it was not fetched again.
  assert.ok(!updated.net.asked.includes('/offline'));
});

test('with no list (the dev server), the worker passes every request on and keeps nothing', async () => {
  const { '/precache.json': _, ...dev } = SITE;
  const worker = sandbox(dev);
  await worker.fire('install');
  assert.equal(await text(await worker.get('/card/JHN.3.16')), 'a card');
  assert.equal(worker.named.get('bible-read'), undefined);
});

test('the recordings, the bridge and the dev files are never touched', async () => {
  const worker = sandbox(SITE);
  await worker.fire('install');
  for (const path of ['/audio/plain-male/kjv/JHN/3.m4a', '/listen', '/api/table/reply', '/@vite/client', '/sw.js']) {
    assert.equal(await worker.get(path), null, path);
  }
});
