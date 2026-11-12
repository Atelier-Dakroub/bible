// The overview of the table (bible-table): the whole table, small, to see
// where everything is and to go to any part of it at once. Here is its
// geometry, with no DOM.
//
// The table is a layer moved by an offset and, in the overview, scaled
// about its corner: a point w on the table shows on the screen at
//
//   offset + scale · w
//
// A box on the screen is a card's getBoundingClientRect(); a box on the
// table is the same box at scale 1 and offset 0.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ left: number, top: number, right: number, bottom: number }} Box */

/** The space between the table's edge and the screen's, in the overview. */
export const MARGIN = 24;

/** The least scale: below it, a large table is only small tiles. */
export const LEAST = 0.04;

/** The least width of a typical card's tile, to read its name and tap it. */
export const TILE = 72;

/**
 * The box around all the boxes; null for none.
 *
 * @param {Box[]} boxes
 * @returns {Box | null}
 */
export function around(boxes) {
  if (!boxes.length) return null;
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    top: Math.min(...boxes.map((box) => box.top)),
    right: Math.max(...boxes.map((box) => box.right)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

/** @param {Box} box its middle */
export const middle = (box) => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });

/**
 * A box on the screen as a box on the table.
 *
 * @param {Box} box
 * @param {Point} offset
 * @param {number} scale
 * @returns {Box}
 */
export function onTable(box, offset, scale) {
  return {
    left: (box.left - offset.x) / scale,
    top: (box.top - offset.y) / scale,
    right: (box.right - offset.x) / scale,
    bottom: (box.bottom - offset.y) / scale,
  };
}

/**
 * The scale and the offset that show the whole of `table` (a box on the
 * table) in the middle of `free` (the part of the screen that the panels
 * leave), with a margin. Never larger than the table is: a table that fits
 * already keeps its size.
 *
 * @param {Box} table
 * @param {Box} free
 * @param {number} [margin]
 */
export function fit(table, free, margin = MARGIN) {
  const width = Math.max(1, table.right - table.left);
  const height = Math.max(1, table.bottom - table.top);
  const room = { width: Math.max(1, free.right - free.left - 2 * margin), height: Math.max(1, free.bottom - free.top - 2 * margin) };
  const scale = Math.max(LEAST, Math.min(1, room.width / width, room.height / height));
  const to = middle(free);
  const from = middle(table);
  return { scale, offset: { x: to.x - scale * from.x, y: to.y - scale * from.y } };
}

/**
 * The least scale at which a typical card (of the median width) is a tile
 * TILE pixels wide.
 *
 * @param {number[]} widths the cards' widths on the table
 */
export function readable(widths) {
  if (!widths.length) return LEAST;
  const median = [...widths].sort((a, b) => a - b)[Math.floor(widths.length / 2)];
  return Math.min(1, Math.max(LEAST, TILE / Math.max(1, median)));
}

/**
 * The overview's view: the whole table, if it shows at a scale where its
 * tiles can be read; else part of it at that scale, about `centre` (the
 * point of the table in the middle of the screen now), kept on the table so
 * that no more empty table shows than must. `whole` says which.
 *
 * @param {Box} table the box around the cards, on the table
 * @param {Box} free
 * @param {number[]} widths the cards' widths on the table
 * @param {Point} centre
 * @param {number} [margin]
 */
export function overviewOf(table, free, widths, centre, margin = MARGIN) {
  const all = fit(table, free, margin);
  const scale = readable(widths);
  if (all.scale >= scale) return { ...all, whole: true };
  const half = { x: (free.right - free.left) / 2 / scale, y: (free.bottom - free.top) / 2 / scale };
  const at = { x: inside(centre.x, table.left, table.right, half.x), y: inside(centre.y, table.top, table.bottom, half.y) };
  const to = middle(free);
  return { scale, offset: { x: to.x - scale * at.x, y: to.y - scale * at.y }, whole: false };
}

/**
 * On one axis: where a view of half-width `half` may centre on a span of
 * the table, as near `c` as it can; the span's middle when it is narrower.
 *
 * @param {number} c
 * @param {number} start
 * @param {number} end
 * @param {number} half
 */
function inside(c, start, end, half) {
  if (end - start <= 2 * half) return (start + end) / 2;
  return Math.min(Math.max(c, start + half), end - half);
}

/**
 * The offset at a new scale that keeps the point of the table under
 * `point` (on the screen) where it is: a zoom about that point.
 *
 * @param {Point} point
 * @param {Point} offset
 * @param {number} scale
 * @param {number} next
 */
export function keeping(point, offset, scale, next) {
  const at = { x: (point.x - offset.x) / scale, y: (point.y - offset.y) / scale };
  return { x: point.x - next * at.x, y: point.y - next * at.y };
}

/**
 * The offset at full size that puts `table` (a card's box on the table) in
 * the middle of `free`; a card longer than the free part shows its top, and
 * one wider shows its start, a margin from the edge.
 *
 * @param {Box} table
 * @param {Box} free
 * @param {number} [margin]
 */
export function centring(table, free, margin = MARGIN) {
  return { x: along(table.left, table.right, free.left, free.right, margin), y: along(table.top, table.bottom, free.top, free.bottom, margin) };
}

/**
 * On one axis: the shift that centres a span in a room, or puts its start a
 * margin in when it does not fit.
 *
 * @param {number} start
 * @param {number} end
 * @param {number} roomStart
 * @param {number} roomEnd
 * @param {number} margin
 */
function along(start, end, roomStart, roomEnd, margin) {
  if (end - start > roomEnd - roomStart - 2 * margin) return roomStart + margin - start;
  return (roomStart + roomEnd) / 2 - (start + end) / 2;
}

/**
 * How far the fingers are from their middle, on average: it shrinks as
 * they pinch in and grows as they spread.
 *
 * @param {Point[]} points
 */
export function spread(points) {
  if (points.length < 2) return 0;
  const at = centre(points);
  return points.reduce((sum, point) => sum + Math.hypot(point.x - at.x, point.y - at.y), 0) / points.length;
}

/**
 * The middle of some points (of the fingers).
 *
 * @param {Point[]} points
 */
export function centre(points) {
  const count = Math.max(1, points.length);
  return { x: points.reduce((sum, point) => sum + point.x, 0) / count, y: points.reduce((sum, point) => sum + point.y, 0) / count };
}

/** How far a pinch goes before it changes the view: to 70%, or to 140%. */
const PINCH_IN = 0.7;
const PINCH_OUT = 1.4;

/**
 * What a pinch on the empty table asks for: "in" (to the overview) once the
 * fingers come to 70% of their first spread, "out" (back to full size) once
 * they go to 140% in the overview; null until then.
 *
 * @param {number} first the spread as the second finger came down
 * @param {number} now
 * @param {boolean} overview whether the overview is on
 * @returns {'in' | 'out' | null}
 */
export function pinchAsks(first, now, overview) {
  if (first <= 0) return null;
  const ratio = now / first;
  if (!overview && ratio <= PINCH_IN) return 'in';
  if (overview && ratio >= PINCH_OUT) return 'out';
  return null;
}

/**
 * The card a tap in the overview is on: of the boxes that hold the point,
 * the one on top (the highest z, then the last). -1 for none.
 *
 * @param {{ box: Box, z: number }[]} cards
 * @param {Point} point
 */
export function tappedIn(cards, point) {
  let best = -1;
  cards.forEach(({ box, z }, index) => {
    const holds = point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
    if (holds && (best < 0 || z >= cards[best].z)) best = index;
  });
  return best;
}

/**
 * What a key asks of the overview: O shows it or leaves it ("toggle"),
 * Escape leaves it while it shows ("leave"); "" for any other key.
 *
 * @param {string} key
 * @param {boolean} overview whether the overview shows
 * @returns {'toggle' | 'leave' | ''}
 */
export function keyAsks(key, overview) {
  if (key === 'o' || key === 'O') return 'toggle';
  return key === 'Escape' && overview ? 'leave' : '';
}
