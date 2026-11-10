// Moving the focus with the arrow keys alone, as a television's remote does:
// from one box on the screen to the nearest box in a direction.

/** @typedef {{ left: number, top: number, right: number, bottom: number }} Box */
/** @typedef {'left' | 'right' | 'up' | 'down'} Direction */

/** @type {Record<string, Direction>} */
export const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

/**
 * The box nearest to `from` in a direction, or -1 when there is none. A box
 * counts when its middle is past `from`'s middle that way and it is more
 * that way than to the side (within 60° of the direction). The nearest is
 * the one with the least distance that way, plus twice its distance to the
 * side, so a box straight ahead beats a nearer one off to the side.
 *
 * @param {Box} from
 * @param {Box[]} boxes
 * @param {Direction} direction
 */
export function nearestIn(from, boxes, direction) {
  const mid = (/** @type {Box} */ box) => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });
  const start = mid(from);
  const [ax, ay] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[direction];
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((box, i) => {
    const end = mid(box);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const ahead = dx * ax + dy * ay;
    const aside = Math.abs(dx * ay - dy * ax);
    if (ahead <= 1 || aside > ahead * Math.tan(Math.PI / 3)) return;
    const score = ahead + 2 * aside;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/**
 * The box nearest to a point, or -1 for none.
 *
 * @param {{ x: number, y: number }} point
 * @param {Box[]} boxes
 */
export function nearestTo(point, boxes) {
  let best = -1;
  let bestDistance = Infinity;
  boxes.forEach((box, i) => {
    const d = Math.hypot((box.left + box.right) / 2 - point.x, (box.top + box.bottom) / 2 - point.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}
