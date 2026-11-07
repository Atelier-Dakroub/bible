#!/usr/bin/env node
// Builds the base map of the biblical world from Natural Earth.
//
//   node tools/import-map.js <directory with Natural Earth 10m GeoJSON> [output file]
//
// Source: Natural Earth (public domain), from github.com/nvkelso/natural-earth-vector,
// geojson/ne_10m_land, ne_10m_lakes and ne_10m_rivers_lake_centerlines.
// The output defaults to app/data/map/near-east.json:
//   { width, height, bounds, land: [path d], lakes: [path d], rivers: [path d] }
//
// The region runs from Italy to Persia and from Upper Egypt to the Black Sea.
// The projection is equirectangular, with longitude scaled by the cosine of
// the middle latitude so that shapes near the Levant keep their proportions.
// Lakes are natural lakes only: the modern reservoirs (Lake Nasser, the
// Atatürk Dam) are not on a map of the ancient world. Points are rounded to a
// tenth of a unit and simplified, so the file stays small.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BOUNDS, WIDTH, HEIGHT, project } from '../app/lib/map.js';

const [source, out = 'app/data/map/near-east.json'] = process.argv.slice(2);

if (!source) {
  console.error('Usage: node tools/import-map.js <directory with Natural Earth GeoJSON> [output file]');
  process.exit(1);
}

// How far a simplified line may stray from the original, in map units.
const TOLERANCE = 0.6;
// Points outside the map are pulled to just outside its edge, so a polygon
// that runs off the map stays closed and its off-map part is not drawn.
const MARGIN = 2;

/** @param {string} name */
async function features(name) {
  return JSON.parse(await readFile(path.join(source, `${name}.geojson`), 'utf8')).features;
}

/** @param {number[][]} ring */
function inRegion(ring) {
  return ring.some(([lon, lat]) => lon >= BOUNDS.west && lon <= BOUNDS.east && lat >= BOUNDS.south && lat <= BOUNDS.north);
}

/**
 * Douglas–Peucker simplification.
 *
 * @param {number[][]} points
 * @param {number} tolerance
 * @returns {number[][]}
 */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = /** @type {number[]} */ (stack.pop());
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let far = -1;
    let distance = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i];
      // A closed ring starts and ends on one point, so its first segment has
      // no length; measure from that point instead.
      const d = length === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
      if (d > distance) {
        distance = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([first, far], [far, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * A ring or a line of [lon, lat] as an SVG path, or null when nothing of it
 * is left.
 *
 * @param {number[][]} line
 * @param {boolean} closed
 */
function toPath(line, closed) {
  const projected = line.map(([lon, lat]) => {
    const { x, y } = project(lon, lat);
    return [Math.min(Math.max(x, -MARGIN), WIDTH + MARGIN), Math.min(Math.max(y, -MARGIN), HEIGHT + MARGIN)];
  });
  const simple = simplify(projected, TOLERANCE);
  if (simple.length < (closed ? 4 : 2)) return null;
  const d = simple.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return closed ? `${d}Z` : d;
}

/**
 * The rings or lines of a geometry, whatever its type.
 *
 * @param {any} geometry
 * @returns {number[][][]}
 */
function partsOf(geometry) {
  if (!geometry?.coordinates?.length) return [];
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates;
    case 'MultiPolygon':
      return geometry.coordinates.flat();
    case 'LineString':
      return [geometry.coordinates];
    case 'MultiLineString':
      return geometry.coordinates;
    default:
      return [];
  }
}

/**
 * @param {any[]} list
 * @param {boolean} closed
 * @param {(properties: any) => boolean} [keep]
 */
function paths(list, closed, keep = () => true) {
  return list
    .filter((feature) => keep(feature.properties ?? {}))
    .flatMap((feature) => partsOf(feature.geometry))
    .filter((part) => part.length && inRegion(part))
    .map((part) => toPath(part, closed))
    .filter(Boolean);
}

const [land, lakes, rivers] = await Promise.all([
  features('ne_10m_land'),
  features('ne_10m_lakes'),
  features('ne_10m_rivers_lake_centerlines'),
]);

const map = {
  width: WIDTH,
  height: HEIGHT,
  bounds: BOUNDS,
  land: paths(land, true),
  lakes: paths(lakes, true, (properties) => properties.featurecla !== 'Reservoir'),
  rivers: paths(rivers, false, (properties) => !/canal|reservoir/i.test(String(properties.featurecla))),
};

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(map));
await writeFile(
  path.join(path.dirname(out), 'source.json'),
  JSON.stringify(
    {
      name: 'Natural Earth, 1:10 million',
      source: 'https://github.com/nvkelso/natural-earth-vector (ne_10m_land, ne_10m_lakes, ne_10m_rivers_lake_centerlines)',
      license: 'Public domain.',
      note: 'Modern coastlines and rivers. Ancient coastlines differed in places, such as the head of the Persian Gulf.',
    },
    null,
    2,
  ) + '\n',
);

const size = (await readFile(out)).length;
console.log(`${map.land.length} land, ${map.lakes.length} lake and ${map.rivers.length} river paths, ${Math.round(size / 1024)} KB. Written to ${out}.`);
