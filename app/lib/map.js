// The map's projection, shared by the import (tools/import-map.js) and the
// server, which places the markers.
//
// Equirectangular, with longitude scaled by the cosine of the middle latitude,
// so that shapes near the Levant keep their proportions. The map is WIDTH
// units wide; an SVG viewBox scales it to any size.

export const BOUNDS = { west: 8, east: 62, south: 18, north: 46 };
export const WIDTH = 1600;

const MIDDLE = ((BOUNDS.north + BOUNDS.south) / 2) * (Math.PI / 180);
const SCALE = WIDTH / ((BOUNDS.east - BOUNDS.west) * Math.cos(MIDDLE));

export const HEIGHT = Math.round((BOUNDS.north - BOUNDS.south) * SCALE);

/**
 * Where a longitude and latitude fall on the map, in map units.
 *
 * @param {number} lon
 * @param {number} lat
 */
export function project(lon, lat) {
  return {
    x: (lon - BOUNDS.west) * Math.cos(MIDDLE) * SCALE,
    y: (BOUNDS.north - lat) * SCALE,
  };
}

/**
 * True when a point is on the map.
 *
 * @param {number} lon
 * @param {number} lat
 */
export function onMap(lon, lat) {
  return lon >= BOUNDS.west && lon <= BOUNDS.east && lat >= BOUNDS.south && lat <= BOUNDS.north;
}

// Zoom inside the map's frame (app/elements/map-view.html).
//
// A view is the part of the map in the frame: { x, y, w } in map units, the
// top left corner and the width. Its height follows from the frame, which has
// the map's own proportions. A zoom of 1 shows the whole map.

export const MAX_ZOOM = 16;

// The zooms at which more names appear. A place named at one level stays
// named at every closer level.
export const LEVELS = [1, 2, 4, 8, 16];

// One map unit, in kilometres. A unit is the same length north to south
// everywhere on the map, and east to west at its middle latitude.
export const KM_PER_UNIT = 110.95 / SCALE;

/** @typedef {{ x: number, y: number, w: number }} View */

/** @returns {View} */
export function wholeMap() {
  return { x: 0, y: 0, w: WIDTH };
}

/** @param {View} view */
export function zoomOf(view) {
  return WIDTH / view.w;
}

/**
 * The view kept inside the map and inside the zoom limits.
 *
 * @param {View} view
 * @returns {View}
 */
export function clampView(view) {
  const w = Math.min(WIDTH, Math.max(WIDTH / MAX_ZOOM, view.w));
  const h = (w * HEIGHT) / WIDTH;
  return {
    x: Math.min(WIDTH - w, Math.max(0, view.x)),
    y: Math.min(HEIGHT - h, Math.max(0, view.y)),
    w,
  };
}

/**
 * The view after a hand moves on the frame. A point in the frame is given as
 * a fraction of the frame's width, from its top left corner. The map point
 * under `from` ends under `to`, and the map grows by `factor`.
 *
 * @param {View} view
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {number} factor
 * @returns {View}
 */
export function moveView(view, from, to, factor) {
  const under = { x: view.x + from.x * view.w, y: view.y + from.y * view.w };
  const w = Math.min(WIDTH, Math.max(WIDTH / MAX_ZOOM, view.w / factor));
  return clampView({ x: under.x - to.x * w, y: under.y - to.y * w, w });
}

/**
 * The view that shows all the points, with a margin, and no closer than
 * `closest`.
 *
 * @param {{ x: number, y: number }[]} points in map units
 * @param {number} [closest] the zoom limit
 * @returns {View}
 */
export function fitView(points, closest = 6) {
  if (!points.length) return wholeMap();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margin = 1.5;
  const w = Math.max(WIDTH / closest, (right - left) * margin, ((bottom - top) * margin * WIDTH) / HEIGHT);
  const h = (w * HEIGHT) / WIDTH;
  return clampView({ x: (left + right) / 2 - w / 2, y: (top + bottom) / 2 - h / 2, w });
}

/**
 * The level of a zoom: an index into LEVELS.
 *
 * @param {number} zoom
 */
export function levelOf(zoom) {
  let level = 0;
  while (level + 1 < LEVELS.length && zoom >= LEVELS[level + 1] * 0.999) level += 1;
  return level;
}

/**
 * The level at which each place is named, or LEVELS.length for never.
 *
 * Places come in order of importance, the most important first. At each
 * level, the places named at the levels before keep their names, and then
 * each other place is named if its name has room. So names do not cover each
 * other, and closer in, there is room for more.
 *
 * @param {{ x: number, y: number, chars: number }[]} places in map units
 * @param {number} pixels how many pixels a map unit is at a zoom of 1
 * @param {{ font: number, gap: number }} type the font size, and the gap from the dot to the name, in pixels
 * @returns {number[]}
 */
export function nameLevels(places, pixels, { font, gap }) {
  const levels = places.map(() => LEVELS.length);
  LEVELS.forEach((zoom, level) => {
    const unit = pixels * zoom;
    // A grid of cells, each the height of a name, holds the names placed so
    // far, so a name is checked against its neighbours only.
    const cell = (font * 1.4) / unit;
    /** @type {Map<string, { left: number, right: number, top: number, bottom: number }[]>} */
    const grid = new Map();
    /** @param {number} i */
    const box = (i) => {
      const { x, y, chars } = places[i];
      return {
        left: x - gap / unit,
        right: x + (gap + chars * font * 0.56 + gap) / unit,
        top: y - (font * 0.8) / unit,
        bottom: y + (font * 0.5) / unit,
      };
    };
    /** @param {{ left: number, right: number, top: number, bottom: number }} b */
    const cells = (b) => {
      const keys = [];
      for (let cx = Math.floor(b.left / cell); cx <= Math.floor(b.right / cell); cx += 1) {
        for (let cy = Math.floor(b.top / cell); cy <= Math.floor(b.bottom / cell); cy += 1) keys.push(`${cx},${cy}`);
      }
      return keys;
    };
    /** @param {{ left: number, right: number, top: number, bottom: number }} b */
    const add = (b) => {
      for (const key of cells(b)) {
        const list = grid.get(key) ?? [];
        list.push(b);
        grid.set(key, list);
      }
    };
    /** @param {{ left: number, right: number, top: number, bottom: number }} b */
    const free = (b) =>
      cells(b).every((key) =>
        (grid.get(key) ?? []).every((o) => b.right <= o.left || b.left >= o.right || b.bottom <= o.top || b.top >= o.bottom),
      );
    places.forEach((_, i) => {
      if (levels[i] < level) add(box(i));
    });
    places.forEach((_, i) => {
      if (levels[i] < level) return;
      const b = box(i);
      if (free(b)) {
        levels[i] = level;
        add(b);
      }
    });
  });
  return levels;
}

/**
 * A scale bar: a round distance whose bar is at most `longest` pixels.
 *
 * @param {number} pixelsPerKm
 * @param {number} [longest]
 */
export function scaleBar(pixelsPerKm, longest = 160) {
  let km = 1;
  for (const each of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]) if (each * pixelsPerKm <= longest) km = each;
  const miles = km / 1.609344;
  return { km, px: km * pixelsPerKm, label: `${km} km (${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi)` };
}
