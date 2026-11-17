// The table's zoom (bible-table): how far in or out the reader sees the
// table, from a quarter of full size to twice it. Below the least zoom, a
// pinch goes on to the overview (lib/overview.js), which shows the whole
// table however small. Here is its arithmetic, with no DOM.
//
// As in the overview, a point w on the table shows on the screen at
//
//   offset + zoom · w

/** @typedef {{ x: number, y: number }} Point */

/** The least zoom, and the most. */
export const LEAST_ZOOM = 0.25;
export const MOST_ZOOM = 2;

/**
 * How far past the least zoom a pinch goes before it shows the overview: to
 * 70% of the least.
 */
export const ON_TO_OVERVIEW = 0.7;

/** The steps of the zoom buttons and the + and - keys. */
export const STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];

/**
 * A zoom kept between the least and the most. A zoom that is not a number
 * is full size.
 *
 * @param {number} zoom
 */
export function clampZoom(zoom) {
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return Math.min(MOST_ZOOM, Math.max(LEAST_ZOOM, zoom));
}

/**
 * The next step in or out from a zoom: the first step past it, or the end.
 *
 * @param {number} zoom
 * @param {1 | -1} way 1 in, -1 out
 */
export function nextStep(zoom, way) {
  // A zoom a hair from a step counts as on it, so one press always moves.
  const near = 0.005;
  if (way > 0) return STEPS.find((step) => step > zoom + near) ?? MOST_ZOOM;
  return [...STEPS].reverse().find((step) => step < zoom - near) ?? LEAST_ZOOM;
}

/**
 * The point of the table under a point on the screen.
 *
 * @param {Point} point on the screen
 * @param {Point} offset
 * @param {number} zoom
 * @returns {Point}
 */
export function tablePoint(point, offset, zoom) {
  return { x: (point.x - offset.x) / zoom, y: (point.y - offset.y) / zoom };
}

/**
 * The offset that shows the point `at` of the table under `point` on the
 * screen, at `zoom`: a pinch keeps the place it began on between the
 * fingers, wherever they move.
 *
 * @param {Point} at on the table
 * @param {Point} point on the screen
 * @param {number} zoom
 * @returns {Point}
 */
export function offsetFor(at, point, zoom) {
  return { x: point.x - zoom * at.x, y: point.y - zoom * at.y };
}

/**
 * What a pinch asks for now: the zoom, or the overview once it goes far
 * enough past the least zoom.
 *
 * @param {number} from the zoom as the pinch began
 * @param {number} ratio the fingers' spread now, over their spread then (or a trackpad's scale)
 * @returns {{ zoom: number, overview: boolean }}
 */
export function pinchZoom(from, ratio) {
  const asked = from * ratio;
  return { zoom: clampZoom(asked), overview: asked < LEAST_ZOOM * ON_TO_OVERVIEW };
}

/**
 * The zoom as a reader reads it: 100%, 67%.
 *
 * @param {number} zoom
 */
export const percent = (zoom) => `${Math.round(zoom * 100)}%`;
