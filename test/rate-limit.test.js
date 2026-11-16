import assert from 'node:assert/strict';
import test from 'node:test';
import { SEARCH_WEIGHT, overLimit, weightOf } from '../app/lib/rate-limit.js';

/** A limiter that counts by key, as Cloudflare's does, with a limit of `most`. */
function limiter(most) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  const asked = /** @type {{ key: string, delta?: number }[]} */ ([]);
  return {
    asked,
    /** @param {{ key: string, delta?: number }} options */
    async limit(options) {
      asked.push(options);
      const count = counts.get(options.key) ?? 0;
      if (count >= most) return { success: false };
      counts.set(options.key, count + (options.delta ?? 1));
      return { success: true };
    },
  };
}

/** @param {string} path @param {string} [address] */
const visit = (path, address = '203.0.113.7') => new Request(`https://bible.dakroub.co${path}`, { headers: { 'CF-Connecting-IP': address } });

test('a search costs more than a page or a card', () => {
  assert.equal(weightOf('/search'), SEARCH_WEIGHT);
  assert.equal(weightOf('/card/JHN.3.16'), 1);
  assert.equal(weightOf('/table'), 1);
});

test('requests go on until the address is over its limit, then get 429', async () => {
  const limits = limiter(3);
  for (let i = 0; i < 3; i++) assert.equal(await overLimit(visit('/card/JHN.3.16'), limits), null);
  const refused = await overLimit(visit('/card/JHN.3.17'), limits);
  assert.equal(refused?.status, 429);
  assert.equal(refused?.headers.get('Retry-After'), '60');
  // Another address has its own count.
  assert.equal(await overLimit(visit('/card/JHN.3.16', '198.51.100.2'), limits), null);
  assert.deepEqual(limits.asked[0], { key: '203.0.113.7', delta: 1 });
});

test('without a limiter, or when it fails, every request goes on', async () => {
  assert.equal(await overLimit(visit('/search?q=love'), undefined), null);
  const broken = { limit: async () => Promise.reject(new Error('down')) };
  assert.equal(await overLimit(visit('/search?q=love'), broken), null);
});
