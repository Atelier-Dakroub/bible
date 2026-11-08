// Replays the recordings from the panel (test/recordings) through the card's
// gesture math, frame by frame, as gesture-card does.
//
// The property: while the same fingers stay down, the point of the card under
// each of the first two fingers stays under that finger. That is what makes a
// card feel held. It holds exactly for one or two fingers, so the replay
// checks it to a hundredth of a pixel, except in a frame where the card hit
// its scale limit and the clamp moved it on purpose.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { apply, clampScale, identity, invert, multiply, scaleOf } from '../app/lib/affine.js';
import { centroid, step } from '../app/lib/gesture.js';

const MIN_SCALE = 0.3;
const MAX_SCALE = 6;

test('invert undoes a matrix', () => {
  const m = { a: 0.8, b: 0.6, c: -0.6, d: 0.8, e: 40, f: -12 };
  const back = multiply(invert(m), m);
  for (const [key, value] of Object.entries(identity())) assert.ok(Math.abs(back[key] - value) < 1e-12, key);
});

for (const file of readdirSync(new URL('./recordings/', import.meta.url))) {
  test(`the card stays under the fingers: ${file}`, () => {
    const { entries } = JSON.parse(readFileSync(new URL(`./recordings/${file}`, import.meta.url), 'utf8'));
    let matrix = identity();
    /** @type {Map<number, { x: number, y: number }>} */
    let points = new Map();
    /** @type {Map<number, { x: number, y: number }>} the card point under each held finger */
    let anchors = new Map();
    let checked = 0;
    let worst = 0;

    const anchorAll = () => {
      const back = invert(matrix);
      anchors = new Map([...points].slice(0, 2).map(([id, at]) => [id, apply(back, at)]));
    };

    for (const entry of entries) {
      const at = { x: entry.x, y: entry.y };
      if (entry.type === 'down') {
        points.set(entry.id, at);
        anchorAll();
      } else if (entry.type === 'move' && points.has(entry.id)) {
        const after = new Map(points);
        after.set(entry.id, at);
        const moved = multiply(step(points, after), matrix);
        const held = clampScale(moved, MIN_SCALE, MAX_SCALE, centroid(after));
        matrix = held;
        points = after;
        assert.ok(Object.values(matrix).every(Number.isFinite), `a finite matrix at ${entry.t} ms`);
        assert.ok(scaleOf(matrix) >= MIN_SCALE - 1e-9 && scaleOf(matrix) <= MAX_SCALE + 1e-9);
        if (held !== moved) {
          anchorAll();
          continue;
        }
        for (const [id, anchor] of anchors) {
          const finger = /** @type {{ x: number, y: number }} */ (points.get(id));
          const drift = Math.hypot(apply(matrix, anchor).x - finger.x, apply(matrix, anchor).y - finger.y);
          worst = Math.max(worst, drift);
          checked += 1;
        }
      } else if (entry.type === 'up' || entry.type === 'cancel') {
        points.delete(entry.id);
        anchorAll();
      }
    }
    assert.ok(checked > 100, `only ${checked} checks`);
    assert.ok(worst < 0.01, `a finger drifted ${worst.toFixed(4)} px from its point on the card`);
  });
}
