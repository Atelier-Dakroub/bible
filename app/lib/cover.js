// Which cards cover a line between two cards. The table draws its lines in
// one layer over the cards, so that a line shows over its own two cards and
// points at the very words. A card above both ends, though, lies over the
// line, as it would on a real table: the part of the line under it, and a
// label there, are hidden.
//
// No DOM: the cards are given as their stacking (z) and their boxes on the
// screen. A turned card's box is the box around it, a little larger than
// the card.

/** @typedef {{ left: number, top: number, right: number, bottom: number }} Box */

/**
 * Each card's place in the stack, from the bottom: by z, and the later of
 * two at the same z on top, as the page draws them.
 *
 * @param {number[]} levels each card's z, in the order of the page
 * @returns {number[]} each card's rank, 0 at the bottom
 */
export function ranks(levels) {
  const order = levels.map((z, index) => ({ z, index })).sort((x, y) => x.z - y.z || x.index - y.index);
  /** @type {number[]} */
  const rank = [];
  order.forEach(({ index }, at) => {
    rank[index] = at;
  });
  return rank;
}

/**
 * Whether two boxes overlap.
 *
 * @param {Box} a
 * @param {Box} b
 */
export const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The cards over a line between two cards: above both, and across the box
 * around the line.
 *
 * @param {number} a one end's card
 * @param {number} b the other end's card
 * @param {Box} span the box around the line
 * @param {number[]} rank each card's rank (ranks)
 * @param {Box[]} boxes each card's box
 * @returns {number[]} the covering cards
 */
export function covering(a, b, span, rank, boxes) {
  const above = Math.max(rank[a], rank[b]);
  return boxes.flatMap((box, index) => (rank[index] > above && overlap(box, span) ? [index] : []));
}

/**
 * Whether a point lies in any of the boxes.
 *
 * @param {{ x: number, y: number }} point
 * @param {Box[]} boxes
 */
export const within = (point, boxes) => boxes.some((box) => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
