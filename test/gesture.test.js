import assert from 'node:assert/strict';
import test from 'node:test';
import { dropLost, step } from '../app/lib/gesture.js';
import { scaleOf } from '../app/lib/affine.js';

test('a finger whose lift was missed turns one finger into a pinch', () => {
  // A palm's lift was stopped at (100, 100); a new finger drags from (300, 100) to (500, 100).
  const before = new Map([[1, { x: 100, y: 100 }], [7, { x: 300, y: 100 }]]);
  const after = new Map([[1, { x: 100, y: 100 }], [7, { x: 500, y: 100 }]]);
  assert.ok(Math.abs(scaleOf(step(before, after)) - 2) < 1e-9, 'the card doubles under one finger');
});

test('dropLost forgets the pointers no longer held, and the drag is a move again', () => {
  const before = new Map([[1, { x: 100, y: 100 }], [7, { x: 300, y: 100 }]]);
  const dropped = dropLost(before, (id) => id === 7);
  assert.equal(dropped, true);
  assert.deepEqual([...before.keys()], [7]);
  const moved = step(before, new Map([[7, { x: 500, y: 100 }]]));
  assert.deepEqual(moved, { a: 1, b: 0, c: 0, d: 1, e: 200, f: 0 });
});

test('dropLost keeps the pointer of the event being handled, and reports no change', () => {
  const points = new Map([[3, { x: 0, y: 0 }]]);
  assert.equal(dropLost(points, () => false, 3), false);
  assert.equal(points.size, 1);
});
