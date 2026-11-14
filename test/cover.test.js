import assert from 'node:assert/strict';
import { test } from 'node:test';
import { covering, overlap, ranks, within } from '../app/lib/cover.js';

const box = (left, top, right, bottom) => ({ left, top, right, bottom });

test('the stack: by z, and the later on top at the same z', () => {
  assert.deepEqual(ranks([3, 1, 3, 2]), [2, 0, 3, 1]);
  assert.deepEqual(ranks([]), []);
});

test('a card above both ends of a line covers it; one below either end does not', () => {
  // 0 and 1 are the ends; 2 lies on top across the line; 3 is under end 1; 4 is on top but away.
  const boxes = [box(0, 0, 100, 100), box(400, 0, 500, 100), box(150, 0, 350, 200), box(150, 0, 350, 200), box(0, 500, 100, 600)];
  const rank = ranks([1, 3, 5, 2, 6]);
  const span = box(100, 50, 400, 50);
  assert.deepEqual(covering(0, 1, span, rank, boxes), [2]);
  // A line within one card's own box, from a card on top: nothing above it.
  assert.deepEqual(covering(4, 4, box(0, 500, 50, 550), rank, boxes), []);
  assert.ok(overlap(box(0, 0, 10, 10), box(5, 5, 20, 20)));
  assert.ok(!overlap(box(0, 0, 10, 10), box(10, 0, 20, 10)), 'boxes that only touch');
});

test('a label under a covering card hides', () => {
  assert.ok(within({ x: 200, y: 50 }, [box(150, 0, 350, 200)]));
  assert.ok(!within({ x: 400, y: 50 }, [box(150, 0, 350, 200)]));
  assert.ok(!within({ x: 0, y: 0 }, []));
});
