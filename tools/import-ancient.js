#!/usr/bin/env node
// The ancient world on the map: the extent of empires and kingdoms, the
// Roman provinces, and the shores of four ages, from the Ancient World
// Mapping Center.
//
//   node tools/import-ancient.js <directory with the AWMC files> [output]
//
// Source: AWMC geodata, https://github.com/AWMC/geodata, under the ODC Open
// Database License (ODbL 1.0); derived from the Barrington Atlas of the Greek
// and Roman World. The files, from the repository's master branch:
//   Cultural-Data/political_shading/<layer>/<layer>.geojson, for the layers
//     below
//   Physical Data/open_water_awmc_work/<age>_open_water/<age>_open_water.shp,
//     the water of each age where it differs from today's: the sea and
//     lagoons over what is land now, such as the gulf at Miletus and
//     Ephesus, and the lagoons of the Nile delta
//
// The files carry no names, so the names and dates below are written by
// hand from AWMC's own titles; the dates are approximate.
//
// The output defaults to app/data/map/ancient.json:
//   { source, license, layers: [{ id, name, when, kind, d }], shores: [{ id, name, when, d }] }
// each `d` an SVG path in map units (lib/map.js): areas as closed rings,
// the provinces as lines.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BOUNDS, project } from '../app/lib/map.js';

const [source, out = 'app/data/map/ancient.json'] = process.argv.slice(2);
if (!source) {
  console.error('Usage: node tools/import-ancient.js <directory with the AWMC files> [output]');
  process.exit(1);
}

// Simplified to within this many map units (a unit is about 3.2 km, so
// about 800 m), and rings smaller than MIN_AREA square units left out.
const TOLERANCE = 0.25;
const MIN_AREA = 0.15;

/** @type {{ id: string, file: string, name: string, when: string, kind: 'area' | 'lines' }[]} */
const LAYERS = [
  { id: 'persia', file: 'extent_of_the_persian_empire.geojson', name: 'The Persian Empire', when: 'about 500 BC', kind: 'area' },
  { id: 'alexander', file: 'alexanders_empire.geojson', name: 'The empire of Alexander', when: '323 BC', kind: 'area' },
  { id: 'hasmonean', file: 'hasmonean_kingdom.geojson', name: 'The Hasmonean kingdom', when: 'at its widest, about 76 BC', kind: 'area' },
  { id: 'rome-60', file: 'roman_empire_bce_60.geojson', name: 'Rome', when: '60 BC', kind: 'area' },
  { id: 'herod', file: 'herods_kingdom.geojson', name: "Herod's kingdom", when: 'at his death, 4 BC', kind: 'area' },
  { id: 'rome-117', file: 'roman_empire_ce_117_extent.geojson', name: 'The Roman Empire', when: 'at its widest, AD 117', kind: 'area' },
  { id: 'provinces-200', file: 'roman_empire_ce_200_provinces.geojson', name: 'The Roman provinces', when: 'AD 200', kind: 'lines' },
];

/** @type {{ id: string, file: string, name: string, when: string }[]} */
const SHORES = [
  { id: 'archaic', file: 'archaic_open_water.shp', name: 'Shores of the archaic age', when: 'about 750–480 BC' },
  { id: 'classical', file: 'classical_open_water.shp', name: 'Shores of the classical age', when: '480–323 BC' },
  { id: 'hellenistic', file: 'hellenistic_open_water.shp', name: 'Shores of the Hellenistic age', when: '323–31 BC' },
  { id: 'roman', file: 'roman_open_water.shp', name: 'Shores of the Roman age', when: '31 BC to AD 300' },
];

/** Douglas–Peucker, iterative. @param {number[][]} points @param {number} tolerance */
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
  return Math.abs(sum / 2);
}

/** @param {number[][]} line in degrees @param {boolean} closed */
function toPath(line, closed) {
  const mapped = line.map(([lon, lat]) => {
    const { x, y } = project(lon, lat);
    return [x, y];
  });
  const simple = simplify(mapped, TOLERANCE);
  if (closed && (simple.length < 3 || area(simple) < MIN_AREA)) return '';
  if (!closed && simple.length < 2) return '';
  return `M${simple.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}${closed ? 'Z' : ''}`;
}

/** @param {[number, number, number, number]} box west, south, east, north */
const onMap = ([west, south, east, north]) => !(east < BOUNDS.west - 1 || west > BOUNDS.east + 1 || north < BOUNDS.south - 1 || south > BOUNDS.north + 1);

/** @param {number[][]} line */
const boxOf = (line) => /** @type {[number, number, number, number]} */ ([
  Math.min(...line.map((p) => p[0])),
  Math.min(...line.map((p) => p[1])),
  Math.max(...line.map((p) => p[0])),
  Math.max(...line.map((p) => p[1])),
]);

/** The rings of a polygon shapefile, in degrees. @param {string} file */
async function shpRings(file) {
  const buffer = await readFile(file);
  /** @type {number[][][]} */
  const found = [];
  let at = 100;
  while (at + 8 <= buffer.length) {
    const length = buffer.readInt32BE(at + 4) * 2;
    const record = at + 8;
    at = record + length;
    if (buffer.readInt32LE(record) !== 5) continue;
    const parts = buffer.readInt32LE(record + 36);
    const points = buffer.readInt32LE(record + 40);
    const starts = Array.from({ length: parts }, (_, i) => buffer.readInt32LE(record + 44 + i * 4));
    const first = record + 44 + parts * 4;
    for (let p = 0; p < parts; p += 1) {
      const end = p + 1 < parts ? starts[p + 1] : points;
      const ring = [];
      for (let i = starts[p]; i < end; i += 1) ring.push([buffer.readDoubleLE(first + i * 16), buffer.readDoubleLE(first + i * 16 + 8)]);
      found.push(ring);
    }
  }
  return found;
}

const layers = [];
for (const layer of LAYERS) {
  const { features } = JSON.parse(await readFile(path.join(source, layer.file), 'utf8'));
  const parts = [];
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    /** @type {number[][][]} */
    const lines =
      geometry.type === 'Polygon' ? geometry.coordinates
      : geometry.type === 'MultiPolygon' ? geometry.coordinates.flat()
      : geometry.type === 'LineString' ? [geometry.coordinates]
      : geometry.type === 'MultiLineString' ? geometry.coordinates
      : [];
    for (const line of lines) {
      if (!onMap(boxOf(line))) continue;
      const d = toPath(line, layer.kind === 'area');
      if (d) parts.push(d);
    }
  }
  layers.push({ id: layer.id, name: layer.name, when: layer.when, kind: layer.kind, d: parts.join('') });
  console.log(`${layer.name}: ${parts.length} parts, ${Math.round(parts.join('').length / 1024)} KB`);
}

const shores = [];
for (const shore of SHORES) {
  const rings = (await shpRings(path.join(source, shore.file))).filter((ring) => onMap(boxOf(ring)));
  const parts = rings.map((ring) => toPath(ring, true)).filter(Boolean);
  shores.push({ id: shore.id, name: shore.name, when: shore.when, d: parts.join('') });
  console.log(`${shore.name}: ${parts.length} rings, ${Math.round(parts.join('').length / 1024)} KB`);
}

await writeFile(
  out,
  `${JSON.stringify({
    source: 'Ancient World Mapping Center, AWMC geodata (https://github.com/AWMC/geodata), derived from the Barrington Atlas of the Greek and Roman World',
    license: 'ODC Open Database License (ODbL 1.0)',
    layers,
    shores,
  })}\n`,
);
console.log(`Written to ${out}.`);
