// Snapping, for a card that a hand or a mouse holds: its edges and middle
// line up with those of the other cards, or sit a GAP beside them, within
// REACH pixels. Cards never turn or scale (gesture-card), so every box is
// upright.
//
// The gesture keeps the matrix the finger asks for apart from the one that is
// shown, and snaps the shown one from it each time. So a snap never builds up:
// a finger that keeps moving pulls the card free again.
//
// Everything is in the coordinates of the cards' parent, the table's world.
// The table zooms the world, so the card passes a reach divided by the zoom:
// the same distance on the screen at any zoom.

/** @typedef {import('./affine.js').Matrix} Matrix */
/** @typedef {{ left: number, top: number, right: number, bottom: number }} Box */
/** @typedef {{ x1: number, y1: number, x2: number, y2: number }} Guide */

export const REACH = 12;
export const GAP = 24;

/**
 * The box a card covers.
 *
 * @param {Matrix} m
 * @param {number} width the card's own width
 * @param {number} height the card's own height
 * @returns {Box}
 */
export function boxOf(m, width, height) {
  return { left: m.e, top: m.f, right: m.e + width * m.a, bottom: m.f + height * m.d };
}

/**
 * How far to move a box so that it lines up with the others, on each axis
 * apart, and the guides to show where it does. Zero on an axis with nothing
 * within `reach`.
 *
 * @param {Box} box
 * @param {Box[]} others
 * @param {number} [reach]
 * @param {number} [gap]
 * @returns {{ dx: number, dy: number, guides: Guide[] }}
 */
export function snapBox(box, others, reach = REACH, gap = GAP) {
  const x = nearestLine(box.left, box.right, others.map((o) => [o.left, o.right]), reach, gap);
  const y = nearestLine(box.top, box.bottom, others.map((o) => [o.top, o.bottom]), reach, gap);

  /** @type {Guide[]} */
  const guides = [];
  if (x) {
    const other = others[x.index];
    const top = Math.min(box.top + (y?.delta ?? 0), other.top);
    const bottom = Math.max(box.bottom + (y?.delta ?? 0), other.bottom);
    guides.push({ x1: x.line, y1: top, x2: x.line, y2: bottom });
  }
  if (y) {
    const other = others[y.index];
    const left = Math.min(box.left + (x?.delta ?? 0), other.left);
    const right = Math.max(box.right + (x?.delta ?? 0), other.right);
    guides.push({ x1: left, y1: y.line, x2: right, y2: y.line });
  }
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guides };
}

/**
 * On one axis: the smallest move that puts the box's start, middle or end on
 * a line of another box, or puts it a gap beside the other box.
 *
 * @param {number} start
 * @param {number} end
 * @param {[number, number][]} others each one's start and end
 * @param {number} reach
 * @param {number} gap
 * @returns {{ delta: number, line: number, index: number } | null}
 */
function nearestLine(start, end, others, reach, gap) {
  const middle = (start + end) / 2;
  /** @type {{ delta: number, line: number, index: number } | null} */
  let best = null;
  others.forEach(([oStart, oEnd], index) => {
    const oMiddle = (oStart + oEnd) / 2;
    /** @type {[number, number, number][]} what moves, to where, and the line to show */
    const pairs = [
      [start, oStart, oStart],
      [end, oEnd, oEnd],
      [middle, oMiddle, oMiddle],
      [start, oEnd + gap, oEnd + gap],
      [end, oStart - gap, oStart - gap],
    ];
    for (const [mine, target, line] of pairs) {
      const delta = target - mine;
      if (Math.abs(delta) <= reach && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line, index };
    }
  });
  return best;
}
