import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxOf, GAP, snapBox } from '../app/lib/snap.js';

test('a box lines up with the edges of another, or sits a gap beside it', () => {
  const other = { left: 100, top: 100, right: 300, bottom: 400 };
  // Its left edge 8 px from the other's: it moves onto it.
  const aligned = snapBox({ left: 108, top: 500, right: 208, bottom: 600 }, [other]);
  assert.equal(aligned.dx, -8);
  assert.equal(aligned.dy, 0);
  assert.deepEqual(aligned.guides, [{ x1: 100, y1: 100, x2: 100, y2: 600 }]);
  // Its left edge near the other's right edge plus the gap: it sits beside it.
  const beside = snapBox({ left: 300 + GAP + 5, top: 103, right: 500, bottom: 300 }, [other]);
  assert.equal(beside.dx, -5);
  assert.equal(beside.dy, -3, 'and its top lines up');
  // Far from everything: it stays.
  assert.deepEqual(snapBox({ left: 1000, top: 1000, right: 1100, bottom: 1100 }, [other]), { dx: 0, dy: 0, guides: [] });
});

test('a card covers its size from its corner', () => {
  assert.deepEqual(boxOf({ a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 }, 400, 200), { left: 10, top: 20, right: 410, bottom: 220 });
});
