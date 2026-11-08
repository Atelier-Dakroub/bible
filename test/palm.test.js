import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createPalmGuard } from '../app/lib/palm.js';

test('three contacts that land together and close together are a palm', () => {
  const guard = createPalmGuard();
  assert.deepEqual(guard.down({ id: 1, x: 100, y: 900, t: 0 }), []);
  assert.deepEqual(guard.down({ id: 2, x: 160, y: 930, t: 30 }), []);
  assert.deepEqual(guard.down({ id: 3, x: 120, y: 980, t: 60 }).sort(), [1, 2, 3]);
  assert.ok(guard.isRejected(1));
  guard.up(1);
  assert.ok(!guard.isRejected(1));
  // A fourth contact of the same hand joins the palm.
  assert.deepEqual(guard.down({ id: 4, x: 140, y: 950, t: 90 }), [4]);
});

test('a pinch, two hands, or slow taps are not a palm', () => {
  const guard = createPalmGuard();
  assert.deepEqual(guard.down({ id: 1, x: 100, y: 100, t: 0 }), []);
  assert.deepEqual(guard.down({ id: 2, x: 400, y: 120, t: 5 }), []);
  assert.deepEqual(guard.down({ id: 3, x: 2000, y: 600, t: 10 }), []);
  assert.deepEqual(guard.down({ id: 4, x: 110, y: 110, t: 500 }), []);
});

test('no touch in the recordings from the panel is taken for a palm', () => {
  for (const file of readdirSync(new URL('./recordings/', import.meta.url))) {
    const { entries } = JSON.parse(readFileSync(new URL(`./recordings/${file}`, import.meta.url), 'utf8'));
    const guard = createPalmGuard();
    let rejected = 0;
    for (const entry of entries) {
      if (entry.type === 'down') rejected += guard.down({ id: entry.id, x: entry.x, y: entry.y, t: entry.t }).length;
      if (entry.type === 'up' || entry.type === 'cancel') guard.up(entry.id);
    }
    assert.equal(rejected, 0, file);
  }
});
