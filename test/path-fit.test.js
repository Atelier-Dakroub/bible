import assert from 'node:assert/strict';
import test from 'node:test';
import { fitPath, inside, ringsOf } from '../app/lib/path-fit.js';

const VIEW = { x: 0, y: 0, w: 100, h: 100 };

test('a path is read as rings of points', () => {
  assert.deepEqual(ringsOf('M0 0L10 0L10 10ZM20 20L30 20L30 30Z'), [
    [[0, 0], [10, 0], [10, 10]],
    [[20, 20], [30, 20], [30, 30]],
  ]);
  assert.ok(inside([5, 2], [[0, 0], [10, 0], [10, 10], [0, 10]]));
  assert.ok(!inside([15, 2], [[0, 0], [10, 0], [10, 10], [0, 10]]));
});

test('a ring inside the view is kept, rounded to suit the step', () => {
  assert.equal(fitPath('M10.123 10.456L50.789 10.111L50.5 50.5Z', VIEW, 1), 'M10.1 10.5L50.8 10.1L50.5 50.5Z');
});

test('points closer than the step are left out', () => {
  assert.equal(fitPath('M10 10L10.2 10L10.4 10L40 10L40 40Z', VIEW, 1), 'M10 10L40 10L40 40Z');
});

test('a ring that leaves the view runs along the margin, out of sight', () => {
  // The margin is 5 (5% of 100): the ring is cut at -5 and 105.
  assert.equal(fitPath('M50 50L500 50L500 60L600 70L50 70Z', VIEW, 1), 'M50 50L105 50L105 70L50 70Z');
});

test('a ring elsewhere is left out, and a ring around the view is the margin', () => {
  assert.equal(fitPath('M500 500L600 500L600 600Z', VIEW, 1), '');
  assert.equal(fitPath('M-1000 -1000L1000 -1000L1000 1000L-1000 1000Z', VIEW, 1), 'M-5 -5L105 -5L105 105L-5 105Z');
  // A frame with a hole in the view: both are kept, so even-odd still cuts the hole.
  assert.equal(fitPath('M-1000 -1000L1000 -1000L1000 1000L-1000 1000ZM20 20L80 20L80 80L20 80Z', VIEW, 1), 'M-5 -5L105 -5L105 105L-5 105ZM20 20L80 20L80 80L20 80Z');
});

test('a staircase within the step of a line is the line', () => {
  // A contour traced on a grid: steps of 0.3 along a slope, with step 1.
  assert.equal(fitPath('M10 10L10.3 10L20 10.3L30 10L40 10.3L50 10L50 50Z', VIEW, 1), 'M10 10L50 10L50 50Z');
  // A corner is kept.
  assert.equal(fitPath('M10 10L50 10L50 50L10 50Z', VIEW, 1), 'M10 10L50 10L50 50L10 50Z');
});
