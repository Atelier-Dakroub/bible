#!/usr/bin/env node
// Replaces the map's coastlines and lakes with GSHHG's, at two levels of
// detail: one for the whole map and one for a close view.
//
//   node tools/import-coast.js <directory with GSHHS_f_L1.shp and GSHHS_f_L2.shp> [map file]
//
// Source: GSHHG 2.3.7, full resolution, from
// https://www.soest.hawaii.edu/pwessel/gshhg/ (gshhg-shp-2.3.7.zip,
// GSHHS_shp/f). GSHHG is under the GNU Lesser General Public License,
// version 3 or later; app/data/map/GSHHG-LICENSE.txt has its notice.
//
// The map file (app/data/map/near-east.json, from tools/import-map.js) keeps
// its rivers, which are Natural Earth's. Its land and lakes become GSHHG's:
//   land, lakes              simplified to TOLERANCE (about 2 km), for the
//                            whole map
//   landDetail, lakesDetail  simplified to DETAIL (about 150 m), for a close
//                            view
// A lake is kept only where Natural Earth has a natural lake (import-map.js
// leaves out reservoirs, such as Lake Nasser, which are not on a map of the
// ancient world).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BOUNDS, HEIGHT, WIDTH, project } from '../app/lib/map.js';

const [source, out = 'app/data/map/near-east.json'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node tools/import-coast.js <directory with GSHHS_f_L1.shp and GSHHS_f_L2.shp> [map file]');
  process.exit(1);
}

const TOLERANCE = 0.6;
const DETAIL = 0.05;
// A ring smaller than this, in square map units, is left out: an islet.
const MIN_AREA = 0.05;
const MIN_AREA_DETAIL = 0.004;
// Points outside the map are pulled to just outside its edge, so a polygon
// that runs off the map stays closed and its off-map part is not drawn.
const MARGIN = 2;

/**
 * The rings of a polygon shapefile whose box meets the map, in degrees.
 *
 * @param {string} file
 * @returns {Promise<[number, number][][]>}
 */
async function rings(file) {
  const buffer = await readFile(file);
  /** @type {[number, number][][]} */
  const found = [];
  let at = 100;
  while (at + 8 <= buffer.length) {
    const length = buffer.readInt32BE(at + 4) * 2;
    const record = at + 8;
    at = record + length;
    if (buffer.readInt32LE(record) !== 5) continue;
    const [west, south, east, north] = [0, 1, 2, 3].map((i) => buffer.readDoubleLE(record + 4 + i * 8));
    if (east < BOUNDS.west - 1 || west > BOUNDS.east + 1 || north < BOUNDS.south - 1 || south > BOUNDS.north + 1) continue;
    const parts = buffer.readInt32LE(record + 36);
    const points = buffer.readInt32LE(record + 40);
    const starts = Array.from({ length: parts }, (_, i) => buffer.readInt32LE(record + 44 + i * 4));
    const first = record + 44 + parts * 4;
    for (let p = 0; p < parts; p += 1) {
      const end = p + 1 < parts ? starts[p + 1] : points;
      /** @type {[number, number][]} */
      const ring = [];
      for (let i = starts[p]; i < end; i += 1) ring.push([buffer.readDoubleLE(first + i * 16), buffer.readDoubleLE(first + i * 16 + 8)]);
      found.push(ring);
    }
  }
  return found;
}

/**
 * Douglas–Peucker simplification, iterative, so a coastline of a million
 * points does not overflow the stack.
 *
 * @param {number[][]} points
 * @param {number} tolerance
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
    const length = Math.hypot(bx - ax, by - ay);
    let index = -1;
    let most = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i];
      const d = length ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length : Math.hypot(px - ax, py - ay);
      if (d > most) {
        most = d;
        index = i;
      }
    }
    if (index >= 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** @param {number[][]} ring */
function area(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/**
 * A ring in degrees as a path in map units, or null when too small.
 *
 * @param {[number, number][]} ring
 * @param {number} tolerance
 * @param {number} minArea
 * @param {number} decimals
 */
function toPath(ring, tolerance, minArea, decimals) {
  const projected = ring.map(([lon, lat]) => {
    const { x, y } = project(lon, lat);
    return [Math.min(Math.max(x, -MARGIN), WIDTH + MARGIN), Math.min(Math.max(y, -MARGIN), HEIGHT + MARGIN)];
  });
  // A ring wholly off the map is clamped to its edge: nothing is left.
  if (projected.every(([x, y]) => x <= -MARGIN || x >= WIDTH + MARGIN || y <= -MARGIN || y >= HEIGHT + MARGIN)) return null;
  const simple = simplify(projected, tolerance);
  if (simple.length < 4 || area(simple) < minArea) return null;
  return `M${simple.map(([x, y]) => `${x.toFixed(decimals)} ${y.toFixed(decimals)}`).join('L')}Z`;
}

/** The box of a path's points, in map units. @param {string} d */
function boxOf(d) {
  const numbers = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

const map = JSON.parse(await readFile(out, 'utf8'));
// Natural Earth's natural lakes, from the map as it is: a GSHHG lake is kept
// when its middle lies in one of them.
const natural = (map.naturalLakes ?? map.lakes).map(boxOf);
const [land, lakes] = await Promise.all([
  rings(path.join(source, 'GSHHS_f_L1.shp')),
  rings(path.join(source, 'GSHHS_f_L2.shp')),
]);
const kept = lakes.filter((ring) => {
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  const { x, y } = project((Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2);
  return natural.some((box) => x >= box.left - 1 && x <= box.right + 1 && y >= box.top - 1 && y <= box.bottom + 1);
});

const paths = (/** @type {[number, number][][]} */ list, /** @type {number} */ tolerance, /** @type {number} */ minArea, /** @type {number} */ decimals) =>
  /** @type {string[]} */ (list.map((ring) => toPath(ring, tolerance, minArea, decimals)).filter(Boolean));

// The Natural Earth lakes stay on record as the list of natural lakes, so
// the import can run again on its own output.
map.naturalLakes ??= map.lakes;
map.land = paths(land, TOLERANCE, MIN_AREA, 1);
map.lakes = paths(kept, TOLERANCE, MIN_AREA, 1);
map.landDetail = paths(land, DETAIL, MIN_AREA_DETAIL, 2);
map.lakesDetail = paths(kept, DETAIL, MIN_AREA_DETAIL, 2);
await writeFile(out, JSON.stringify(map));

const source2 = path.join(path.dirname(out), 'source.json');
const sources = JSON.parse(await readFile(source2, 'utf8'));
sources.coast = {
  name: 'GSHHG 2.3.7, full resolution',
  source: 'https://www.soest.hawaii.edu/pwessel/gshhg/ (gshhg-shp-2.3.7.zip: GSHHS_shp/f/GSHHS_f_L1 and L2)',
  license: 'GNU Lesser General Public License, version 3 or later (GSHHG-LICENSE.txt).',
  note: 'Coastlines and lakes. The rivers stay Natural Earth\'s. Modern shores: ancient ones differed in places.',
};
await writeFile(source2, `${JSON.stringify(sources, null, 2)}\n`);

const size = (await readFile(out)).length;
const sum = (/** @type {string[]} */ list) => Math.round(list.join('').length / 1024);
console.log(
  `land ${map.land.length} (${sum(map.land)} KB), lakes ${map.lakes.length}; detail land ${map.landDetail.length} (${sum(map.landDetail)} KB), lakes ${map.lakesDetail.length}. ${Math.round(size / 1024)} KB written to ${out}.`,
);
