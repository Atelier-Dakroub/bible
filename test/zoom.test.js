import assert from 'node:assert/strict';
import test from 'node:test';
import { LEAST_ZOOM, MOST_ZOOM, clampZoom, nextStep, offsetFor, percent, pinchZoom, tablePoint } from '../app/lib/zoom.js';

test('the zoom stays between the least and the most', () => {
  assert.equal(clampZoom(0.1), LEAST_ZOOM);
  assert.equal(clampZoom(5), MOST_ZOOM);
  assert.equal(clampZoom(0.8), 0.8);
  assert.equal(clampZoom(Number.NaN), 1);
  assert.equal(clampZoom(0), 1);
});

test('the buttons and keys step from one zoom to the next', () => {
  assert.equal(nextStep(1, 1), 1.25);
  assert.equal(nextStep(1, -1), 0.8);
  // Between two steps: to the next one that way.
  assert.equal(nextStep(0.9, 1), 1);
  assert.equal(nextStep(0.9, -1), 0.8);
  // A hair from a step counts as on it.
  assert.equal(nextStep(1.001, 1), 1.25);
  assert.equal(nextStep(MOST_ZOOM, 1), MOST_ZOOM);
  assert.equal(nextStep(LEAST_ZOOM, -1), LEAST_ZOOM);
});

test('a pinch keeps the place under the fingers, wherever they go', () => {
  const offset = { x: 100, y: 50 };
  const at = tablePoint({ x: 300, y: 250 }, offset, 1);
  assert.deepEqual(at, { x: 200, y: 200 });
  // At twice the size, with the fingers moved, the same place is between them.
  const next = offsetFor(at, { x: 320, y: 260 }, 2);
  assert.deepEqual(tablePoint({ x: 320, y: 260 }, next, 2), at);
});

test('a pinch past the least zoom goes on to the overview', () => {
  assert.deepEqual(pinchZoom(1, 1.5), { zoom: 1.5, overview: false });
  assert.deepEqual(pinchZoom(0.5, 0.4), { zoom: LEAST_ZOOM, overview: false });
  assert.deepEqual(pinchZoom(0.5, 0.3), { zoom: LEAST_ZOOM, overview: true });
});

test('the zoom reads as a percentage', () => {
  assert.equal(percent(1), '100%');
  assert.equal(percent(0.666), '67%');
});
