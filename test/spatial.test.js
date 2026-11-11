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

test('a thing moves the least that brings it inside an area', async () => {
  const { shiftInto, inset, viewportBox } = await import('../app/lib/spatial.js');
  const area = { left: 0, top: 0, right: 100, bottom: 100 };
  assert.deepEqual(shiftInto({ left: 10, top: 10, right: 20, bottom: 20 }, area), { dx: 0, dy: 0 });
  assert.deepEqual(shiftInto({ left: 90, top: 95, right: 110, bottom: 105 }, area), { dx: -10, dy: -5 });
  assert.deepEqual(shiftInto({ left: -5, top: -8, right: 5, bottom: 2 }, area), { dx: 5, dy: 8 });
  // A phone's keyboard: the visual viewport is 300 high, a dock starts at 250.
  const box = inset(viewportBox({ offsetLeft: 0, offsetTop: 40, width: 400, height: 300 }), { top: 16, left: 16, right: 16, bottom: 24 }, 250);
  assert.deepEqual(box, { left: 16, top: 56, right: 384, bottom: 226 });
  assert.deepEqual(viewportBox(null, { width: 800, height: 600 }), { left: 0, top: 0, right: 800, bottom: 600 });
});
