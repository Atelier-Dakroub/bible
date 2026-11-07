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
