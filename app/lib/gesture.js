// Turns pointer positions into the step a held object takes.
//
// The step is computed from one frame to the next, not from the start of the
// gesture. A finger that joins or leaves then needs no special case: the next
// frame is measured from wherever the fingers are now.

import { identity, similarity, translation } from './affine.js';

/** @typedef {import('./affine.js').Matrix} Matrix */
/** @typedef {import('./affine.js').Point} Point */

/**
 * The step between two frames. `before` and `after` map a pointer id to its
 * position. Only the ids in both count, and only the first two of those: a
 * third finger on a card does nothing yet.
 *
 * @param {Map<number, Point>} before
 * @param {Map<number, Point>} after
 * @returns {Matrix}
 */
export function step(before, after) {
  const ids = [...after.keys()].filter((id) => before.has(id)).slice(0, 2);

  if (ids.length === 0) return identity();

  const [first, second] = ids;
  const p1 = /** @type {Point} */ (before.get(first));
  const q1 = /** @type {Point} */ (after.get(first));

  if (ids.length === 1) return translation(q1.x - p1.x, q1.y - p1.y);

  const p2 = /** @type {Point} */ (before.get(second));
  const q2 = /** @type {Point} */ (after.get(second));
  return similarity(p1, p2, q1, q2);
}

/**
 * The middle of the points: where a pinch is centered.
 *
 * @param {Map<number, Point>} points
 * @returns {Point}
 */
export function centroid(points) {
  let x = 0;
  let y = 0;
  for (const point of points.values()) {
    x += point.x;
    y += point.y;
  }
  const count = points.size || 1;
  return { x: x / count, y: y / count };
}

/**
 * How far the fingers moved together between two frames: the mean of the
 * moves of the pointers in both. The table pans by this, and never turns or
 * scales, so the rest of the motion is ignored.
 *
 * @param {Map<number, Point>} before
 * @param {Map<number, Point>} after
 * @returns {Point}
 */
export function pan(before, after) {
  let x = 0;
  let y = 0;
  let count = 0;
  for (const [id, point] of after) {
    const start = before.get(id);
    if (!start) continue;
    x += point.x - start.x;
    y += point.y - start.y;
    count += 1;
  }
  return count ? { x: x / count, y: y / count } : { x: 0, y: 0 };
}
