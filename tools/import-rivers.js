#!/usr/bin/env node
// The map's rivers for a close view, from HydroRIVERS, finer than Natural
// Earth's, which the whole map keeps.
//
//   node tools/import-rivers.js <directory with the HydroRIVERS shapefiles> [map file]
//
// Source: HydroRIVERS version 1.0 (Lehner and Grill 2013), from
// https://www.hydrosheds.org/products/hydrorivers: HydroRIVERS_v10_eu_shp.zip
// (Europe and the Middle East) and HydroRIVERS_v10_af_shp.zip (Africa, for the
// Nile). The directory holds HydroRIVERS_v10_eu.shp and .dbf, and
// HydroRIVERS_v10_af.shp and .dbf, at any depth. HydroRIVERS is under the
// HydroSHEDS license: free for non-commercial and commercial use, with
// attribution; the data may be passed on only inside a work made from it.
// RiverATLAS (HydroATLAS, CC BY 4.0) holds the same reaches, and can replace
// it with no change to the output.
//
// Each reach of a river is a line with its average discharge (DIS_AV_CMS, in
// m³/s, as modelled for a natural flow) and the area it drains (UPLAND_SKM,
// in km²). A reach is kept when it flows (MIN_FLOW or more), or when it drains
// a large area (MIN_DRY_AREA) though it is dry most of the year: a wadi, such
// as the Brook of Egypt (Wadi el-Arish). Each is kept in a class:
//   great   FLOW_GREAT m³/s or more: the Nile, the Euphrates, the Tigris
//   large   FLOW_LARGE or more: the Jordan at its mouth, the Orontes
//   stream  the rest that flow: the Jabbok, the Kishon
//   dry     a wadi
// The reaches of a class are joined into lines down their main stem, and
// simplified to TOLERANCE.
//
// HydroRIVERS has one channel where a river splits: the Nile's delta has
// one branch. So in the delta (DELTA) its reaches are left out, and Natural
// Earth's branches, from the map file's whole-map rivers, take their place.
//
// The output goes into the map file (app/data/map/near-east.json) as
//   riversDetail: { great: d, large: d, stream: d, dry: d }
// each one SVG path of many lines, for the close view (map-view's detail).

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BOUNDS, project } from '../app/lib/map.js';

const [source, out = 'app/data/map/near-east.json'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node tools/import-rivers.js <directory with the HydroRIVERS shapefiles> [map file]');
  process.exit(1);
}

const MIN_FLOW = 3;
const MIN_DRY_AREA = 8000;
const FLOW_LARGE = 40;
const FLOW_GREAT = 400;
// How far a simplified line may stray, in map units (about 220 m).
const TOLERANCE = 0.08;
// How far past the map's edge a reach is still read, in degrees.
const MARGIN = 0.5;
// The Nile's delta, from Cairo, where Natural Earth splits it: west, south, east, north.
const DELTA = [29.8, 29.98, 32.2, 31.7];
/** @param {number[]} point [lon, lat] */
const inDelta = ([lon, lat]) => lon >= DELTA[0] && lon <= DELTA[2] && lat >= DELTA[1] && lat <= DELTA[3];

/** @param {string} dir @returns {Promise<string[]>} */
async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => (entry.isDirectory() ? filesIn(path.join(dir, entry.name)) : [path.join(dir, entry.name)])));
  return nested.flat();
}

/**
 * The records of a dBASE file, with the named fields only, as numbers.
 *
 * @param {Buffer} buffer
 * @param {string[]} names
 * @returns {Record<string, number>[]}
 */
function readDbf(buffer, names) {
  const count = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  /** @type {{ name: string, at: number, length: number }[]} */
  const fields = [];
  let at = 1;
  for (let p = 32; buffer[p] !== 0x0d; p += 32) {
    const name = buffer.toString('latin1', p, p + 11).replace(/\0.*$/, '');
    const length = buffer[p + 16];
    fields.push({ name, at, length });
    at += length;
  }
  const wanted = fields.filter((field) => names.includes(field.name));
  const records = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const base = headerLength + i * recordLength;
    /** @type {Record<string, number>} */
    const record = {};
    for (const field of wanted) record[field.name] = Number(buffer.toString('latin1', base + field.at, base + field.at + field.length).trim());
    records[i] = record;
  }
  return records;
}

/**
 * The lines of a polyline shapefile, in order, each as [lon, lat] points;
 * null for a line wholly off the map.
 *
 * @param {Buffer} buffer
 * @returns {(number[][] | null)[]}
 */
function readShp(buffer) {
  /** @type {(number[][] | null)[]} */
  const lines = [];
  let p = 100;
  while (p < buffer.length) {
    const length = buffer.readInt32BE(p + 4) * 2;
    const content = p + 8;
    const type = buffer.readInt32LE(content);
    if (type !== 3) {
      lines.push(null);
      p = content + length;
      continue;
    }
    const [west, south, east, north] = [0, 1, 2, 3].map((n) => buffer.readDoubleLE(content + 4 + n * 8));
    const off = east < BOUNDS.west - MARGIN || west > BOUNDS.east + MARGIN || north < BOUNDS.south - MARGIN || south > BOUNDS.north + MARGIN;
    if (off) {
      lines.push(null);
      p = content + length;
      continue;
    }
    const parts = buffer.readInt32LE(content + 36);
    const count = buffer.readInt32LE(content + 40);
    const points = content + 44 + parts * 4;
    /** @type {number[][]} */
    const line = [];
    for (let i = 0; i < count; i += 1) line.push([buffer.readDoubleLE(points + i * 16), buffer.readDoubleLE(points + i * 16 + 8)]);
    lines.push(line);
    p = content + length;
  }
  return lines;
}

/**
 * Douglas–Peucker simplification.
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
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let far = -1;
    let distance = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i];
      const d = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
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

/** @typedef {{ id: number, down: number, upland: number, flow: number, line: number[][], kind: string }} Reach */

/** @param {Reach} reach */
const kindOf = (reach) =>
  reach.flow >= FLOW_GREAT ? 'great' : reach.flow >= FLOW_LARGE ? 'large' : reach.flow >= MIN_FLOW ? 'stream' : reach.upland >= MIN_DRY_AREA ? 'dry' : '';

/** @type {Map<number, Reach>} */
const reaches = new Map();
const files = await filesIn(source);
for (const region of ['eu', 'af']) {
  const shp = files.find((file) => file.endsWith(`HydroRIVERS_v10_${region}.shp`));
  const dbf = files.find((file) => file.endsWith(`HydroRIVERS_v10_${region}.dbf`));
  if (!shp || !dbf) {
    console.error(`HydroRIVERS_v10_${region}.shp and .dbf are not in ${source}.`);
    process.exit(1);
  }
  const lines = readShp(await readFile(shp));
  const records = readDbf(await readFile(dbf), ['HYRIV_ID', 'NEXT_DOWN', 'UPLAND_SKM', 'DIS_AV_CMS']);
  lines.forEach((line, i) => {
    if (!line || line.every(inDelta)) return;
    const record = records[i];
    /** @type {Reach} */
    const reach = { id: record.HYRIV_ID, down: record.NEXT_DOWN, upland: record.UPLAND_SKM, flow: record.DIS_AV_CMS, line, kind: '' };
    reach.kind = kindOf(reach);
    if (reach.kind) reaches.set(reach.id, reach);
  });
}

// The main stem: of the reaches that flow into one, the one that drains most.
/** @type {Map<number, Reach>} */
const main = new Map();
for (const reach of reaches.values()) {
  const below = reaches.get(reach.down);
  if (!below) continue;
  const other = main.get(below.id);
  if (!other || reach.upland > other.upland) main.set(below.id, reach);
}

// Each line starts at a reach that is not the main stem of the one below it
// in its own class, and runs down while it is.
/** @param {Reach} reach */
const continues = (reach) => {
  const below = reaches.get(reach.down);
  return below && below.kind === reach.kind && main.get(below.id) === reach ? below : null;
};
/** @type {Set<number>} the reaches that start no line: another line runs into them */
const inner = new Set();
for (const reach of reaches.values()) {
  const below = continues(reach);
  if (below) inner.add(below.id);
}

/** @type {Record<string, string[]>} */
const paths = { great: [], large: [], stream: [], dry: [] };
const counts = { great: 0, large: 0, stream: 0, dry: 0 };
for (const reach of reaches.values()) {
  if (inner.has(reach.id)) continue;
  /** @type {number[][]} */
  const points = [];
  /** @type {Reach | null} */
  let at = reach;
  while (at) {
    for (const point of points.length ? at.line.slice(1) : at.line) points.push(point);
    at = continues(at);
  }
  // A line that flows into a reach of another class ends where that reach
  // begins, so the two meet.
  const projected = points.map(([lon, lat]) => {
    const { x, y } = project(lon, lat);
    return [x, y];
  });
  const simple = simplify(projected, TOLERANCE);
  if (simple.length < 2) continue;
  paths[reach.kind].push(simple.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''));
  counts[/** @type {keyof typeof counts} */ (reach.kind)] += 1;
}

const map = JSON.parse(await readFile(out, 'utf8'));
// The delta's branches, from Natural Earth: its paths wholly in the delta.
const corner = project(DELTA[0], DELTA[3]);
const far = project(DELTA[2], DELTA[1]);
for (const d of /** @type {string[]} */ (map.rivers)) {
  const points = [...d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
  if (points.every(([x, y]) => x >= corner.x && x <= far.x && y >= corner.y && y <= far.y)) {
    paths.great.push(d);
    counts.great += 1;
  }
}
map.riversDetail = Object.fromEntries(Object.entries(paths).map(([kind, list]) => [kind, list.join('')]));
await writeFile(out, JSON.stringify(map));

const sourceFile = path.join(path.dirname(out), 'source.json');
const sources = JSON.parse(await readFile(sourceFile, 'utf8'));
sources.rivers = {
  name: 'HydroRIVERS 1.0 (Lehner and Grill 2013)',
  source: 'https://www.hydrosheds.org/products/hydrorivers (HydroRIVERS_v10_eu_shp.zip, HydroRIVERS_v10_af_shp.zip)',
  license: 'HydroSHEDS license: free for non-commercial and commercial use, with attribution; passed on only inside a work made from it. The same reaches are in RiverATLAS (HydroATLAS), under CC BY 4.0.',
  attribution: 'Lehner, B., Grill G. (2013). Global river hydrography and network routing: baseline data and new approaches to study the world’s large river systems. Hydrological Processes, 27(15): 2171–2186. Data available at www.hydrosheds.org.',
  note: 'The close view only: the whole map keeps Natural Earth’s rivers. Modern rivers, with a natural flow as modelled.',
};
await writeFile(sourceFile, `${JSON.stringify(sources, null, 2)}\n`);

const kb = Object.fromEntries(Object.entries(map.riversDetail).map(([kind, d]) => [kind, Math.round(/** @type {string} */ (d).length / 1024)]));
console.log(`${reaches.size} reaches as lines: ${JSON.stringify(counts)}; KB ${JSON.stringify(kb)}. Written to ${out}.`);
