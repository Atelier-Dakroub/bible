// Snapping, for a card that a hand or a mouse holds.
//
// Three snaps, in this order:
//   - the turn: within ANGLE of upright (or of a quarter turn), the card
//     stands exactly upright (or at the quarter turn);
//   - the scale: within SCALE of full size, the card is exactly full size;
//   - the place: an upright card's edges and middle line up with those of the
//     other upright cards, or sit a GAP beside them, within REACH pixels.
//
// The gesture keeps the matrix the fingers ask for apart from the one that is
// shown, and snaps the shown one from it each time. So a snap never builds up:
// a finger that keeps moving pulls the card free again.
//
// Everything is in the coordinates of the cards' parent, where the table does
// not scale, so pixels there are pixels on the screen.

import { angleOf, scaleOf } from './affine.js';

/** @typedef {import('./affine.js').Matrix} Matrix */
/** @typedef {import('./affine.js').Point} Point */
/** @typedef {{ left: number, top: number, right: number, bottom: number }} Box */
/** @typedef {{ x1: number, y1: number, x2: number, y2: number }} Guide */

export const ANGLE = (5 * Math.PI) / 180;
export const SCALE = 0.04;
export const REACH = 12;
export const GAP = 24;

const QUARTER = Math.PI / 2;

/**
 * The same card, turned and scaled so that `about` stays where it is.
 *
 * @param {Matrix} m
 * @param {number} angle the new turn
 * @param {number} scale the new scale
 * @param {Point} about
 * @returns {Matrix}
 */
function withTurnAndScale(m, angle, scale, about) {
  // The point of the card under `about`.
  const det = m.a * m.d - m.b * m.c;
  const x = about.x - m.e;
  const y = about.y - m.f;
  const p = { x: (m.d * x - m.c * y) / det, y: (m.a * y - m.b * x) / det };
  // Exact for a quarter turn: cos and sin of those are -1, 0 or 1.
  const quarter = Math.abs(angle / QUARTER - Math.round(angle / QUARTER)) < 1e-9;
  const cos = quarter ? Math.round(Math.cos(angle)) : Math.cos(angle);
  const sin = quarter ? Math.round(Math.sin(angle)) : Math.sin(angle);
  const a = scale * cos;
  const b = scale * sin;
  return { a, b, c: -b, d: a, e: about.x - (a * p.x - b * p.y), f: about.y - (b * p.x + a * p.y) };
}

/**
 * The turn and the scale, snapped.
 *
 * @param {Matrix} m
 * @param {Point} about the point that stays still, such as the fingers' middle
 * @returns {Matrix}
 */
export function snapTurnAndScale(m, about) {
  const angle = angleOf(m);
  const scale = scaleOf(m);
  const nearest = Math.round(angle / QUARTER) * QUARTER;
  const turn = Math.abs(angle - nearest) < ANGLE ? nearest : angle;
  const size = Math.abs(scale - 1) < SCALE ? 1 : scale;
  if (turn === angle && size === scale) return m;
  return withTurnAndScale(m, turn, size, about);
}

/**
 * True when the matrix stands upright.
 *
 * @param {Matrix} m
 */
export function isUpright(m) {
  // Matrices built up from many small steps keep a trace of a turn.
  return Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9 && m.a > 0;
}

/**
 * The box an upright card covers.
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
