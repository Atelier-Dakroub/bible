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

/**
 * The visual viewport as a box on the screen: the part of the page a phone's
 * keyboard leaves in sight. With no visual viewport, the window.
 *
 * @param {{ offsetLeft: number, offsetTop: number, width: number, height: number } | null | undefined} port
 * @param {{ width: number, height: number }} [window] the window's size, for tests
 * @returns {Box}
 */
export function viewportBox(port, window = { width: globalThis.innerWidth ?? 0, height: globalThis.innerHeight ?? 0 }) {
  const left = port?.offsetLeft ?? 0;
  const top = port?.offsetTop ?? 0;
  return { left, top, right: left + (port?.width ?? window.width), bottom: top + (port?.height ?? window.height) };
}

/**
 * A box made smaller by a margin on each side, and ending above a line.
 *
 * @param {Box} box
 * @param {{ top: number, left: number, right: number, bottom: number }} margin
 * @param {number} [above] a line the box must end above (the top of a dock)
 * @returns {Box}
 */
export function inset(box, margin, above = Infinity) {
  return { left: box.left + margin.left, top: box.top + margin.top, right: box.right - margin.right, bottom: Math.min(box.bottom, above) - margin.bottom };
}

/**
 * How far to move a thing so that it is inside an area: no move when it is
 * already, else the least that brings its far edge in (the near edge wins
 * when it is larger than the area).
 *
 * @param {Box} thing
 * @param {Box} area
 * @returns {{ dx: number, dy: number }}
 */
export function shiftInto(thing, area) {
  return { dx: shiftAlong(thing.left, thing.right, area.left, area.right), dy: shiftAlong(thing.top, thing.bottom, area.top, area.bottom) };
}

/**
 * @param {number} start
 * @param {number} end
 * @param {number} low
 * @param {number} high
 */
function shiftAlong(start, end, low, high) {
  if (end > high) return high - end;
  return start < low ? low - start : 0;
}
