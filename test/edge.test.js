// What the app needs on Cloudflare, tested under Node: the data store, the
// relay, the Access check and the sync of the named workspaces.

import assert from 'node:assert/strict';
import test from 'node:test';
import { load, loadOr, shelf } from '../app/data/store.js';
import { createRelay } from '../app/lib/relay.js';
import { verify } from '../app/lib/access.js';
import { merge, valid } from '../app/lib/sync.js';

test('the store reads a data file by its name in app/data, through the assets binding when there is one', async () => {
  const books = await load('kjv/books.json');
  assert.equal(books[0].id, 'GEN');
  assert.deepEqual(await loadOr('xrefs/NONE.json', {}), {});
  const asked = [];
  /** @type {any} */ (globalThis).bibleAssets = {
    fetch: async (/** @type {Request} */ request) => {
      asked.push(new URL(request.url).pathname);
      return new Response('{"from":"assets"}');
    },
  };
  try {
    assert.deepEqual(await load('kjv/GEN.json'), { from: 'assets' });
    assert.deepEqual(asked, ['/data/kjv/GEN.json']);
  } finally {
    delete (/** @type {any} */ (globalThis).bibleAssets);
  }
});

test('a shelf makes each value once, and does not keep a failure', async () => {
  const cache = shelf(2);
  let made = 0;
  const make = () => Promise.resolve((made += 1));
  assert.equal(await cache('a', make), 1);
  assert.equal(await cache('a', make), 1);
  await assert.rejects(cache('b', () => Promise.reject(new Error('no'))));
  await Promise.resolve();
  assert.equal(await cache('b', make), 2);
});

test('the relay sends a command to the open table and answers with its reply', async () => {
  const relay = createRelay();
  const controller = new AbortController();
  const stream = relay.events(controller.signal);
  assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  assert.equal(relay.size, 1);
  const reader = /** @type {ReadableStream<Uint8Array>} */ (stream.body).getReader();
  const decoder = new TextDecoder();
  assert.match(decoder.decode((await reader.read()).value), /^event: ready/);

  const answer = relay.command(new Request('http://x/api/table/command', { method: 'POST', body: JSON.stringify({ action: 'state' }) }));
  const event = decoder.decode((await reader.read()).value);
  const command = JSON.parse(/^data: (.*)$/m.exec(event)?.[1] ?? '{}');
  assert.equal(command.action, 'state');
  assert.match(command.id, /^[0-9a-f]{32}$/);

  const wrong = await relay.reply(new Request('http://x/api/table/reply', { method: 'POST', body: JSON.stringify({ id: 'guess', ok: true }) }));
  assert.equal(wrong.status, 404);
  await relay.reply(new Request('http://x/api/table/reply', { method: 'POST', body: JSON.stringify({ id: command.id, ok: true, result: { cards: [] } }) }));
  assert.deepEqual(await (await answer).json(), { id: command.id, ok: true, result: { cards: [] } });

  controller.abort();
  assert.equal(relay.size, 0);
  const none = await relay.command(new Request('http://x/api/table/command', { method: 'POST', body: '{}' }));
  assert.equal(none.status, 409);
});

/** base64url @param {Uint8Array | string} value */
const b64 = (value) => Buffer.from(value).toString('base64url');

test('an Access token is valid only with the right signature, audience, issuer and time', async () => {
  const team = 'https://example.cloudflareaccess.com';
  const aud = 'audience-tag';
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = /** @type {any} */ (await crypto.subtle.exportKey('jwk', pair.publicKey));
  const keys = [{ kid: 'k1', kty: jwk.kty, n: jwk.n, e: jwk.e }];
  const now = 1_800_000_000;
  /** @param {object} claims @param {string} [kid] */
  const sign = async (claims, kid = 'k1') => {
    const body = `${b64(JSON.stringify({ alg: 'RS256', kid }))}.${b64(JSON.stringify(claims))}`;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(body));
    return `${body}.${b64(new Uint8Array(signature))}`;
  };
  const good = { aud: [aud], iss: team, exp: now + 600, email: 'Reader@Example.com' };
  const options = { team, aud, keys, now };
  assert.deepEqual(await verify(await sign(good), options), { email: 'reader@example.com', service: '' });
  assert.deepEqual(await verify(await sign({ ...good, email: undefined, common_name: 'client.access' }), options), { email: '', service: 'client.access' });
  assert.equal(await verify(await sign({ ...good, aud: ['other'] }), options), null);
  assert.equal(await verify(await sign({ ...good, iss: 'https://other.cloudflareaccess.com' }), options), null);
  assert.equal(await verify(await sign({ ...good, exp: now - 1 }), options), null);
  assert.equal(await verify(await sign(good, 'k2'), options), null);
  const [head, , signature] = (await sign(good)).split('.');
  assert.equal(await verify(`${head}.${b64(JSON.stringify({ ...good, email: 'someone@else.com' }))}.${signature}`, options), null);
  assert.equal(await verify('not a token', options), null);
});

test('the sync keeps the workspace saved last, and a deletion wins over an older copy', () => {
  const workspace = { cards: [] };
  const a = {
    Romans: { saved: '2026-11-10T10:00:00.000Z', workspace },
    John: { saved: '2026-11-10T09:00:00.000Z', workspace },
  };
  const b = {
    Romans: { saved: '2026-11-10T11:00:00.000Z', removed: true },
    John: { saved: '2026-11-10T08:00:00.000Z', workspace: { cards: [1] } },
    Acts: { saved: '2026-11-10T07:00:00.000Z', workspace },
    '': { saved: '2026-11-10T07:00:00.000Z', workspace },
    Broken: { saved: 'yesterday', workspace },
  };
  const all = merge(a, b);
  assert.deepEqual(Object.keys(all).sort(), ['Acts', 'John', 'Romans']);
  assert.equal(all.Romans.removed, true);
  assert.equal(all.John, a.John);
  assert.equal(valid('Big', { saved: '2026-11-10T07:00:00.000Z', workspace: { text: 'x'.repeat(600 * 1024) } }), false);
});
