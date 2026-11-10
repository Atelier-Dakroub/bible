import assert from 'node:assert/strict';
import test from 'node:test';
import { nearestIn, nearestTo } from '../app/lib/spatial.js';

/** @param {number} x @param {number} y */
const box = (x, y, size = 10) => ({ left: x, top: y, right: x + size, bottom: y + size });

test('the arrow keys move to the nearest box that way, straight ahead first', () => {
  const from = box(100, 100);
  const boxes = [box(200, 100), box(150, 160), box(40, 100), box(100, 20), box(100, 300)];
  assert.equal(nearestIn(from, boxes, 'right'), 0);
  assert.equal(nearestIn(from, boxes, 'left'), 2);
  assert.equal(nearestIn(from, boxes, 'up'), 3);
  // Straight down is further, but (150, 160) is more down than aside.
  assert.equal(nearestIn(from, boxes, 'down'), 1);
});

test('a box mostly to the side does not count, and none that way is -1', () => {
  assert.equal(nearestIn(box(100, 100), [box(110, 400)], 'right'), -1);
  assert.equal(nearestIn(box(100, 100), [box(40, 100)], 'right'), -1);
});

test('with nothing in focus, the box nearest the middle of the screen', () => {
  assert.equal(nearestTo({ x: 500, y: 300 }, [box(0, 0), box(480, 290), box(900, 600)]), 1);
});
