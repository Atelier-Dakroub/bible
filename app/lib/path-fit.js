// A map path cut down to one view of it, for a page that draws a piece of the
// map inline (routes/design.html). The map's own paths cover the whole map,
// at the detail of its closest zoom, which is megabytes a piece; a view
// needs only what falls in it, at the detail it is drawn at.
//
// The paths are the map's: absolute moves and lines, each ring closed
// (M x yL x y … Z). Each ring is clamped to the view with a margin around
// it, so a ring that leaves the view runs along the margin instead, out of
// sight; then a point closer than `step` to the one before is left out, and
// one that lies within `step` of the line the others make, and the numbers
// are rounded to suit `step`. A ring wholly outside the view is
// left out, unless it goes around the view, as the frame of the land does:
// then it is the margin's rectangle. Coasts and contours have short
// segments, so a segment that crosses the view between two points outside
// it does not occur.

/** @typedef {{ x: number, y: number, w: number, h: number }} Box */
/** @typedef {[number, number]} Point */

/**
 * The rings of a path, each a list of points.
 *
 * @param {string} d
 * @returns {Point[][]}
 */
export function ringsOf(d) {
  return d
    .split('M')
    .filter((part) => part.trim())
    .map((part) => {
      const numbers = part.replace(/Z/gi, '').split(/[\sL,]+/).filter(Boolean).map(Number);
      /** @type {Point[]} */
      const points = [];
      for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
      return points;
    });
}

/**
 * Whether a point is inside a ring (even-odd).
 *
 * @param {Point} point
 * @param {Point[]} ring
 */
export function inside([x, y], ring) {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) within = !within;
  }
  return within;
}

/**
 * A ring clamped to a rectangle, with a point left out where it is closer
 * than `step` to the one kept before it. Null when nothing of it is inside.
 *
 * @param {Point[]} ring
 * @param {{ left: number, top: number, right: number, bottom: number }} edge
 * @param {number} step
 * @returns {Point[] | null}
 */
function clamped(ring, edge, step) {
  /** @type {Point[]} */
  const kept = [];
  let within = false;
  for (const [x, y] of ring) {
    const point = /** @type {Point} */ ([Math.min(Math.max(x, edge.left), edge.right), Math.min(Math.max(y, edge.top), edge.bottom)]);
    if (point[0] === x && point[1] === y && x > edge.left && x < edge.right && y > edge.top && y < edge.bottom) within = true;
    const last = kept.at(-1);
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= step) kept.push(point);
  }
  return within ? simplified(withoutRuns(kept, edge), step) : null;
}

/**
 * How far a point is from the line through two others.
 *
 * @param {Point} point
 * @param {Point} a
 * @param {Point} b
 */
function offLine([x, y], [ax, ay], [bx, by]) {
  const length = Math.hypot(bx - ax, by - ay);
  if (!length) return Math.hypot(x - ax, y - ay);
  return Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / length;
}

/**
 * A ring with the points left out that lie closer than `tolerance` to the
 * line the others make (Douglas-Peucker): a contour traced on a grid is a
 * staircase, of which a view at this size shows only the line.
 *
 * @param {Point[]} ring
 * @param {number} tolerance
 */
export function simplified(ring, tolerance) {
  if (ring.length < 4) return ring;
  const line = [...ring, ring[0]];
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [first, last] = /** @type {number[]} */ (stack.pop());
    let far = -1;
    let most = tolerance;
    for (let i = first + 1; i < last; i++) {
      const off = offLine(line[i], line[first], line[last]);
      if (off > most) {
        most = off;
        far = i;
      }
    }
    if (far < 0) continue;
    keep[far] = 1;
    stack.push([first, far], [far, last]);
  }
  return ring.filter((_, i) => keep[i]);
}

/**
 * A ring without the points in the middle of a run along one edge: a run of
 * points on the left edge, say, is a line from its first to its last.
 *
 * @param {Point[]} ring
 * @param {{ left: number, top: number, right: number, bottom: number }} edge
 */
function withoutRuns(ring, edge) {
  const on = (/** @type {Point} */ [x, y]) => (x === edge.left ? 'l' : x === edge.right ? 'r' : y === edge.top ? 't' : y === edge.bottom ? 'b' : '');
  return ring.filter((point, i) => {
    const side = on(point);
    if (!side || i === 0 || i === ring.length - 1) return true;
    return !(on(ring[i - 1]) === side && on(ring[i + 1]) === side);
  });
}

/**
 * A path cut to a view and made as fine as `step` needs.
 *
 * @param {string} d
 * @param {Box} view
 * @param {number} step the smallest distance kept, in the path's units: about half a pixel as drawn
 * @returns {string} '' when nothing of it is in the view
 */
export function fitPath(d, view, step) {
  const margin = Math.max(view.w, view.h) * 0.05;
  const edge = { left: view.x - margin, top: view.y - margin, right: view.x + view.w + margin, bottom: view.y + view.h + margin };
  const digits = Math.max(0, Math.ceil(-Math.log10(step / 4)));
  const centre = /** @type {Point} */ ([view.x + view.w / 2, view.y + view.h / 2]);
  const rings = ringsOf(d).flatMap((ring) => {
    const cut = clamped(ring, edge, step);
    if (cut && cut.length >= 3) return [cut];
    // Nothing of it in the view: it goes around the view, or it is elsewhere.
    if (!cut && ring.length >= 3 && inside(centre, ring)) {
      return [
        [
          [edge.left, edge.top],
          [edge.right, edge.top],
          [edge.right, edge.bottom],
          [edge.left, edge.bottom],
        ],
      ];
    }
    return [];
  });
  // Rounded, and without the zeros at the end: 10.0 is 10.
  const number = (/** @type {number} */ value) => String(Number(value.toFixed(digits)) || 0);
  return rings.map((ring) => `M${ring.map(([x, y]) => `${number(x)} ${number(y)}`).join('L')}Z`).join('');
}
