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
 *   tools: { open: boolean, float: Point | null, w: number, h: number, anchor: Point },
 *   safe?: Insets
 * }} LayoutInput the screen, the edge, each part's own size as measured, and
 *   the screen's safe-area insets (a phone's notch and home bar), which the
 *   chrome keeps clear of
 */

/** @typedef {{ top: number, right: number, bottom: number, left: number }} Insets */

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
 * Where each part of the chrome goes: laid out inside the screen's safe
 * area, so the notch and the home bar cover none of it, while the table
 * itself runs to the screen's edges.
 *
 * @param {LayoutInput} input
 * @returns {Layout}
 */
export function layout(input) {
  const s = input.safe ?? { top: 0, right: 0, bottom: 0, left: 0 };
  /** @param {Point | null} p */
  const into = (p) => (p ? { x: p.x - s.left, y: p.y - s.top } : null);
  const inner = place({
    ...input,
    width: input.width - s.left - s.right,
    height: input.height - s.top - s.bottom,
    search: { ...input.search, float: into(input.search.float) },
    timeline: { ...input.timeline, float: into(input.timeline.float) },
    tools: { ...input.tools, float: into(input.tools.float), anchor: /** @type {Point} */ (into(input.tools.anchor)) },
  });
  /** @template {Box | null} T @param {T} box @returns {T} */
  const out = (box) => (box ? { ...box, x: box.x + s.left, y: box.y + s.top } : box);
  return {
    rail: out(inner.rail),
    search: out(inner.search),
    timeline: out(inner.timeline),
    tools: out(inner.tools),
    free: { left: inner.free.left + s.left, right: inner.free.right + s.left, top: inner.free.top + s.top, bottom: inner.free.bottom + s.top },
  };
}

/**
 * The layout inside a rectangle from 0, 0 (the safe area).
 *
 * @param {LayoutInput} input
 * @returns {Layout}
 */
function place(input) {
  // A phone has the rail at the bottom, the width of the screen, and each
  // panel is a sheet above it, the width of the screen too; nothing floats.
  const edge = input.phone ? 'bottom' : input.edge;
  const rail = railBox(input, edge);
  const area = areaBeside(input, edge);
  const free = { ...area };
  // The rail's own side of that part, before the docked panels take some.
  const near = { ...area };
  if (input.phone) return { rail, ...phoneSheets(input, area), free };
  const timeline = timelineBox(input, edge, area, free);
  const search = searchBox(input, edge, area, free);
  return { rail, search, timeline, tools: toolsBox(input, edge, near), free };
}

/** @typedef {{ left: number, top: number, right: number, bottom: number }} Area */

/**
 * The rail: along its edge, at its own size; a phone's the width of the
 * screen.
 *
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @returns {Box}
 */
function railBox(input, edge) {
  const { width: W, height: H, gap: g } = input;
  if (upright(edge)) return { x: edge === 'left' ? g : W - g - input.rail.w, y: g, w: input.rail.w, h: null };
  return { x: g, y: edge === 'top' ? g : H - g - input.rail.h, w: input.phone ? W - 2 * g : input.rail.w, h: null };
}

/**
 * The part of the screen beside the rail.
 *
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @returns {Area}
 */
function areaBeside(input, edge) {
  const { width: W, height: H, gap: g, rail } = input;
  return {
    left: edge === 'left' ? 2 * g + rail.w : g,
    top: edge === 'top' ? 2 * g + rail.h : g,
    right: edge === 'right' ? W - 2 * g - rail.w : W - g,
    bottom: edge === 'bottom' ? H - 2 * g - rail.h : H - g,
  };
}

/**
 * On a phone, each open panel is a sheet above the rail; the search, open
 * with results, fills the screen above it.
 *
 * @param {LayoutInput} input
 * @param {Area} area
 */
function phoneSheets(input, area) {
  const g = input.gap;
  const sheet = (/** @type {number} */ h, /** @type {boolean} */ full) => ({
    x: g,
    y: full ? g : Math.max(g, area.bottom - h),
    w: input.width - 2 * g,
    h: full ? area.bottom - g : null,
  });
  return {
    search: input.search.open ? { ...sheet(input.search.h, input.search.expanded), y: g } : null,
    timeline: input.timeline.open ? sheet(input.timeline.h, false) : null,
    tools: input.tools.open ? sheet(input.tools.h, false) : null,
  };
}

/**
 * The timeline: floating where it was left, or docked along the far edge
 * from a top rail (else the bottom), which takes its height from the area
 * and from the cards' part.
 *
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @param {Area} area
 * @param {Area} free
 * @returns {Box | null}
 */
function timelineBox(input, edge, area, free) {
  const strip = input.timeline;
  if (!strip.open) return null;
  if (!strip.float) return dockTimeline(input, edge, area, free);
  const w = Math.min(strip.w, input.width);
  return { ...kept(strip.float, w, strip.h, input.width, input.height), w, h: null };
}

/**
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @param {Area} area
 * @param {Area} free
 * @returns {Box}
 */
function dockTimeline(input, edge, area, free) {
  const h = input.timeline.h;
  const atTop = edge === 'top';
  const y = atTop ? area.top : area.bottom - h;
  if (atTop) {
    area.top = y + h + input.gap;
    free.top = area.top;
  } else {
    area.bottom = y - input.gap;
    free.bottom = area.bottom;
  }
  return { x: area.left, y, w: area.right - area.left, h: null };
}

/**
 * The search: floating where it was left, or docked beside the rail, which
 * takes its width from the cards' part.
 *
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @param {Area} area
 * @param {Area} free
 * @returns {Box | null}
 */
function searchBox(input, edge, area, free) {
  const search = input.search;
  if (!search.open) return null;
  const w = Math.min(search.w, area.right - area.left);
  return search.float ? floatSearch(input, search.float, w) : dockSearch(input, edge, area, free, w);
}

/**
 * Open with results, a floating search reaches most of the way down.
 *
 * @param {LayoutInput} input
 * @param {Point} float
 * @param {number} w
 * @returns {Box}
 */
function floatSearch(input, float, w) {
  const at = kept(float, w, input.search.h, input.width, input.height);
  const h = input.search.expanded ? Math.max(input.search.h, Math.round((input.height - at.y - input.gap) * 0.9)) : null;
  return { ...at, w, h };
}

/**
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @param {Area} area
 * @param {Area} free
 * @param {number} w
 * @returns {Box}
 */
function dockSearch(input, edge, area, free, w) {
  const x = edge === 'right' ? area.right - w : area.left;
  if (edge === 'right') free.right = Math.min(free.right, x - input.gap);
  else free.left = Math.max(free.left, x + w + input.gap);
  return { x, y: searchTop(input, edge, area), w, h: input.search.expanded ? area.bottom - area.top : null };
}

/**
 * At rest, beside a bottom rail, the field sits low, near the rail.
 *
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @param {Area} area
 */
const searchTop = (input, edge, area) => (!input.search.expanded && edge === 'bottom' ? area.bottom - input.search.h : area.top);

/**
 * The tools: floating where they were left, or by their button on the
 * rail.
 *
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @param {Area} near
 * @returns {Box | null}
 */
function toolsBox(input, edge, near) {
  const tools = input.tools;
  if (!tools.open) return null;
  const { width: W, height: H, gap: g } = input;
  const w = Math.min(tools.w, W - 2 * g);
  const h = Math.min(tools.h, H - 2 * g);
  if (tools.float) return { ...kept(tools.float, w, h, W, H), w, h: null };
  return upright(edge) ? toolsBeside(input, edge, near, w, h) : toolsAlong(input, edge, near, w, h);
}

/**
 * Beside its button on a rail on the left or the right, as far down as it
 * fits.
 *
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @param {Area} near
 * @param {number} w
 * @param {number} h
 * @returns {Box}
 */
function toolsBeside(input, edge, near, w, h) {
  const x = edge === 'left' ? near.left : near.right - w;
  const y = Math.round(Math.min(Math.max(input.gap, input.tools.anchor.y - 24), input.height - input.gap - h));
  return { x, y, w, h: null };
}

/**
 * Over or under its button on a rail along the top or the bottom.
 *
 * @param {LayoutInput} input
 * @param {Edge} edge
 * @param {Area} near
 * @param {number} w
 * @param {number} h
 * @returns {Box}
 */
function toolsAlong(input, edge, near, w, h) {
  const x = Math.round(Math.min(Math.max(input.gap, input.tools.anchor.x - w / 2), input.width - input.gap - w));
  const y = edge === 'top' ? near.top : near.bottom - h;
  return { x, y, w, h: null };
}
