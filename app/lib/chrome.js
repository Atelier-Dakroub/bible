// The table's chrome: the rail of tools on one edge of the screen, and the
// panels it opens (the search, the timeline and the tools). table-rail
// arranges them; this module holds the settings and the arithmetic, so it can
// be tested without a page.
//
// A panel is docked or floating. Docked, it lies beside the rail: the search
// a column, the timeline a strip across the free part of the screen (at the
// top under a top rail, at the bottom otherwise), and the tools a sheet next
// to their button. Floating, it is where a finger left it, kept on the
// screen.
//
// All sizes are in screen (CSS) pixels.

export const EDGES = /** @type {const} */ (['left', 'right', 'top', 'bottom']);
export const SIZES = /** @type {const} */ (['s', 'm', 'l']);
export const PANELS = /** @type {const} */ (['search', 'timeline', 'tools']);

/** The chrome's own scale for each size (CSS zoom on the rail and panels). */
export const ZOOM = { s: 0.8, m: 1, l: 1.25 };

/** @typedef {typeof EDGES[number]} Edge */
/** @typedef {typeof SIZES[number]} Size */
/** @typedef {typeof PANELS[number]} Panel */
/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, w: number, h: number | null }} Box `h` null: as tall as its content */

/**
 * The settings kept in this browser: where the rail is, how large the chrome
 * is, whether it is hidden, and where each floating panel is (null when the
 * panel is docked).
 *
 * @typedef {{ edge: Edge, size: Size, hidden: boolean, float: Record<Panel, Point | null> }} Settings
 */

const KEY = 'bible.chrome';

/** @returns {Settings} */
export function defaults() {
  return { edge: 'left', size: 'm', hidden: false, float: { search: null, timeline: null, tools: null } };
}

/**
 * Settings from what was kept, with anything missing or wrong at its
 * default.
 *
 * @param {unknown} kept
 * @returns {Settings}
 */
export function parseSettings(kept) {
  const settings = defaults();
  if (!kept || typeof kept !== 'object') return settings;
  const raw = /** @type {Record<string, any>} */ (kept);
  if (EDGES.includes(raw.edge)) settings.edge = raw.edge;
  if (SIZES.includes(raw.size)) settings.size = raw.size;
  settings.hidden = raw.hidden === true;
  for (const panel of PANELS) {
    const point = raw.float?.[panel];
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) settings.float[panel] = { x: point.x, y: point.y };
  }
  return settings;
}

/** @returns {Settings} */
export function loadSettings() {
  try {
    return parseSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return defaults();
  }
}

/** @param {Settings} settings */
export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // No storage: the settings last until the page closes.
  }
}

/**
 * The edge nearest a point: where the rail goes when a finger lets it go.
 *
 * @param {Point} point
 * @param {number} width
 * @param {number} height
 * @returns {Edge}
 */
export function nearestEdge({ x, y }, width, height) {
  const distances = { left: x, right: width - x, top: y, bottom: height - y };
  return /** @type {Edge} */ (Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0]);
}

/**
 * True when the rail stands up: on the left or the right.
 *
 * @param {Edge} edge
 */
export const upright = (edge) => edge === 'left' || edge === 'right';

/**
 * @typedef {{
 *   width: number, height: number, gap: number, phone: boolean, edge: Edge,
 *   rail: { w: number, h: number },
 *   search: { open: boolean, float: Point | null, expanded: boolean, w: number, h: number },
 *   timeline: { open: boolean, float: Point | null, w: number, h: number },
 *   tools: { open: boolean, float: Point | null, w: number, h: number, anchor: Point }
 * }} LayoutInput the screen, the edge, and each part's own size as measured
 */

/**
 * @typedef {{
 *   rail: Box, search: Box | null, timeline: Box | null, tools: Box | null,
 *   free: { left: number, top: number, right: number, bottom: number }
 * }} Layout each part's box (null when closed), and the part of the screen
 *   that the rail and the docked panels leave free for the cards
 */

/**
 * A floating panel's box, moved back onto the screen where it went off.
 *
 * @param {Point} at
 * @param {number} w
 * @param {number} h
 * @param {number} width
 * @param {number} height
 */
function kept(at, w, h, width, height) {
  return {
    x: Math.round(Math.min(Math.max(0, at.x), Math.max(0, width - w))),
    y: Math.round(Math.min(Math.max(0, at.y), Math.max(0, height - Math.min(h, height)))),
  };
}

/**
 * Where each part of the chrome goes.
 *
 * @param {LayoutInput} input
 * @returns {Layout}
 */
export function layout(input) {
  const { width: W, height: H, gap: g, phone } = input;
  // A phone has the rail at the bottom, the width of the screen, and each
  // panel is a sheet above it, the width of the screen too; nothing floats.
  const edge = phone ? 'bottom' : input.edge;
  const standing = upright(edge);

  /** @type {Box} */
  const rail = standing
    ? { x: edge === 'left' ? g : W - g - input.rail.w, y: g, w: input.rail.w, h: null }
    : { x: g, y: edge === 'top' ? g : H - g - input.rail.h, w: phone ? W - 2 * g : input.rail.w, h: null };

  // The part of the screen beside the rail.
  const area = {
    left: edge === 'left' ? 2 * g + input.rail.w : g,
    top: edge === 'top' ? 2 * g + input.rail.h : g,
    right: edge === 'right' ? W - 2 * g - input.rail.w : W - g,
    bottom: edge === 'bottom' ? H - 2 * g - input.rail.h : H - g,
  };
  const free = { ...area };
  // The rail's own side of that part, before the docked panels take some.
  const near = { ...area };

  if (phone) {
    const sheet = (/** @type {number} */ h, /** @type {boolean} */ full) => ({
      x: g,
      y: full ? g : Math.max(g, area.bottom - h),
      w: W - 2 * g,
      h: full ? area.bottom - g : null,
    });
    return {
      rail,
      search: input.search.open ? { ...sheet(input.search.h, input.search.expanded), y: g } : null,
      timeline: input.timeline.open ? sheet(input.timeline.h, false) : null,
      tools: input.tools.open ? sheet(input.tools.h, false) : null,
      free,
    };
  }

  /** @type {Box | null} */
  let timeline = null;
  if (input.timeline.open) {
    if (input.timeline.float) {
      const w = Math.min(input.timeline.w, W);
      timeline = { ...kept(input.timeline.float, w, input.timeline.h, W, H), w, h: null };
    } else {
      const atTop = edge === 'top';
      const y = atTop ? area.top : area.bottom - input.timeline.h;
      timeline = { x: area.left, y, w: area.right - area.left, h: null };
      if (atTop) area.top = y + input.timeline.h + g;
      else area.bottom = y - g;
      if (atTop) free.top = area.top;
      else free.bottom = area.bottom;
    }
  }

  /** @type {Box | null} */
  let search = null;
  if (input.search.open) {
    const w = Math.min(input.search.w, area.right - area.left);
    if (input.search.float) {
      const at = kept(input.search.float, w, input.search.h, W, H);
      // Open with results, a floating search reaches most of the way down.
      const h = input.search.expanded ? Math.max(input.search.h, Math.round((H - at.y - g) * 0.9)) : null;
      search = { ...at, w, h };
    } else {
      const x = edge === 'right' ? area.right - w : area.left;
      // At rest, beside a bottom rail, the field sits low, near the rail.
      const y = !input.search.expanded && edge === 'bottom' ? area.bottom - input.search.h : area.top;
      search = { x, y, w, h: input.search.expanded ? area.bottom - area.top : null };
      if (edge === 'right') free.right = Math.min(free.right, x - g);
      else free.left = Math.max(free.left, x + w + g);
    }
  }

  /** @type {Box | null} */
  let tools = null;
  if (input.tools.open) {
    const w = Math.min(input.tools.w, W - 2 * g);
    const h = Math.min(input.tools.h, H - 2 * g);
    if (input.tools.float) {
      tools = { ...kept(input.tools.float, w, h, W, H), w, h: null };
    } else if (standing) {
      // Beside its button on the rail, as far down as it fits.
      const x = edge === 'left' ? near.left : near.right - w;
      const y = Math.round(Math.min(Math.max(g, input.tools.anchor.y - 24), H - g - h));
      tools = { x, y, w, h: null };
    } else {
      const x = Math.round(Math.min(Math.max(g, input.tools.anchor.x - w / 2), W - g - w));
      const y = edge === 'top' ? near.top : near.bottom - h;
      tools = { x, y, w, h: null };
    }
  }

  return { rail, search, timeline, tools, free };
}
