#!/usr/bin/env node
// Builds the relief of the map from ETOPO 2022: elevation bands with their
// contour lines, and a hill shade.
//
//   node tools/import-relief.js <ETOPO NetCDF file> [--levant <file>] [data file] [image file]
//
// Source: NOAA NCEI, ETOPO 2022 (15 arc-second), free to use and share. The
// map's area at every second cell (30 arc-seconds, about 900 m), from NOAA's
// ERDDAP service:
//   https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.nc?z[(18):2:(46)][(8):2:(62)]
// and, for the sharper hill shade of the Levant, every cell (15
// arc-seconds, about 450 m) of the Levant alone:
//   https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.nc?z[(29.2):1:(34.6)][(33.4):1:(37.8)]
//
// The outputs default to:
//   app/data/map/relief.json    { levels, bands: [path d], shades }: for each level,
//                               the land at or above it, as one path whose
//                               rings alternate (fill-rule evenodd). Its edge
//                               is the contour line.
//   app/public/map/hillshade.png  a gray image of the whole map: 128 is flat,
//                               darker is a slope turned from the light (from
//                               the northwest, as maps light it), lighter is a
//                               slope turned to it.
//   app/public/map/hillshade-levant.png  the same for the Levant, sharper,
//                               for a close view. relief.json gives where
//                               each image goes on the map (`shades`).
//
// The map's projection is linear in longitude and in latitude
// (lib/map.js), so the grid maps to the map by scaling alone, and the image
// stretches over the map's box exactly.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { BOUNDS, HEIGHT, KM_PER_UNIT, WIDTH, project } from '../app/lib/map.js';

const args = process.argv.slice(2);
const flag = args.indexOf('--levant');
const levantSource = flag >= 0 ? args.splice(flag, 2)[1] : null;
const [source, dataOut = 'app/data/map/relief.json', imageOut = 'app/public/map/hillshade.png'] = args;
if (!source) {
  console.error('Usage: node tools/import-relief.js <ETOPO NetCDF file> [--levant <file>] [data file] [image file]');
  process.exit(1);
}

// The levels of the bands, in metres: the lowlands, the hills, the high
// country, the mountains.
const LEVELS = [200, 500, 1000, 1500, 2000, 3000];
// The contours are traced on a grid of every CONTOUR_STEP cells (about 1.8
// km), and simplified to within TOLERANCE map units (about 1 km). A ring
// smaller than MIN_AREA square units (a hill of a few hundred metres) is left
// out.
const CONTOUR_STEP = 2;
const TOLERANCE = 0.3;
const MIN_AREA = 0.6;
// The hill shade: pixels per map unit, the light, and how much the relief is
// raised so that it shows at this scale.
const SHADE_PIXELS = 1.5;
// The Levant has a sharper image of its own, at about its grid's own detail:
// 8 pixels a unit from the 15″ grid, or 4 from the map's own 30″ grid.
const LEVANT = /** @type {[number, number, number, number]} */ ([33.4, 34.6, 37.8, 29.2]);
const AZIMUTH = 315;
const ALTITUDE = 45;
const EXAGGERATION = 4;

// ---- NetCDF 3 (classic and 64-bit offset), the one variable we need ----

/**
 * @param {Buffer} buffer
 * @returns {{ dims: { name: string, length: number }[], vars: Map<string, { dims: number[], type: number, begin: number, attrs: Record<string, unknown> }> }}
 */
function readNetCDF(buffer) {
  if (buffer.toString('latin1', 0, 3) !== 'CDF') throw new Error('Not a NetCDF 3 file');
  const wide = buffer[3] === 2;
  let at = 8;
  const int = () => {
    const value = buffer.readInt32BE(at);
    at += 4;
    return value;
  };
  const name = () => {
    const length = int();
    const text = buffer.toString('utf8', at, at + length);
    at += Math.ceil(length / 4) * 4;
    return text;
  };
  const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 4, 6: 8 };
  const attrs = () => {
    /** @type {Record<string, unknown>} */
    const found = {};
    int();
    const count = int();
    for (let i = 0; i < count; i += 1) {
      const key = name();
      const type = int();
      const n = int();
      const size = SIZE[/** @type {1} */ (type)] * n;
      if (type === 2) found[key] = buffer.toString('utf8', at, at + n);
      else if (type === 5) found[key] = buffer.readFloatBE(at);
      else if (type === 6) found[key] = buffer.readDoubleBE(at);
      else if (type === 3) found[key] = buffer.readInt16BE(at);
      else if (type === 4) found[key] = buffer.readInt32BE(at);
      at += Math.ceil(size / 4) * 4;
    }
    return found;
  };
  int();
  const dimCount = int();
  const dims = [];
  for (let i = 0; i < dimCount; i += 1) dims.push({ name: name(), length: int() });
  attrs();
  int();
  const varCount = int();
  const vars = new Map();
  for (let i = 0; i < varCount; i += 1) {
    const key = name();
    const n = int();
    const ids = Array.from({ length: n }, int);
    const varAttrs = attrs();
    const type = int();
    int();
    const begin = wide ? Number(buffer.readBigInt64BE((at += 8) - 8)) : int();
    vars.set(key, { dims: ids, type, begin, attrs: varAttrs });
  }
  return { dims, vars };
}

/**
 * An ETOPO grid: elevations in metres, row by row from the north.
 *
 * @param {string} file
 */
async function loadGrid(file) {
  const buffer = await readFile(file);
  const { dims, vars } = readNetCDF(buffer);
  const latVar = /** @type {any} */ (vars.get('latitude'));
  const lonVar = /** @type {any} */ (vars.get('longitude'));
  const zVar = /** @type {any} */ (vars.get('z'));
  const rows = dims[latVar.dims[0]].length;
  const cols = dims[lonVar.dims[0]].length;
  /** @param {{ begin: number }} v @param {number} i */
  const coordinate = (v, i) => buffer.readDoubleBE(v.begin + i * 8);
  const lats = Float64Array.from({ length: rows }, (_, i) => coordinate(latVar, i));
  const lons = Float64Array.from({ length: cols }, (_, i) => coordinate(lonVar, i));
  const fill = Number(zVar.attrs._FillValue ?? NaN);
  // z[lat][lon], with the first row to the north, as the map has it.
  const north = lats[0] > lats[rows - 1];
  const z = new Float32Array(rows * cols);
  const read =
    zVar.type === 5
      ? (/** @type {number} */ i) => buffer.readFloatBE(zVar.begin + i * 4)
      : (/** @type {number} */ i) => buffer.readInt16BE(zVar.begin + i * 2);
  for (let r = 0; r < rows; r += 1) {
    const from = north ? r : rows - 1 - r;
    for (let c = 0; c < cols; c += 1) {
      const value = read(from * cols + c);
      z[r * cols + c] = value === fill ? -9999 : value;
    }
  }
  const grid = { z, rows, cols, top: north ? lats[0] : lats[rows - 1], step: Math.abs(lats[1] - lats[0]), west: lons[0] };
  console.log(`${file}: ${cols} × ${rows} cells, ${Math.round(grid.step * 3600)}″, from ${grid.west.toFixed(3)}°E ${grid.top.toFixed(3)}°N`);
  return grid;
}

/** @typedef {Awaited<ReturnType<typeof loadGrid>>} Grid */

const main = await loadGrid(source);
const { z, rows, cols, top, step, west } = main;


// ---- The bands: marching squares, closed at the grid's edge ----

/**
 * The grid every `every` cells, each value the highest of its block, so a
 * peak is not lost. A border of very low cells closes every contour.
 *
 * @param {Grid} grid
 * @param {number} every
 */
function coarse({ z, rows, cols }, every) {
  const w = Math.floor(cols / every) + 2;
  const h = Math.floor(rows / every) + 2;
  const grid = new Float32Array(w * h).fill(-99999);
  for (let r = 0; r < h - 2; r += 1) {
    for (let c = 0; c < w - 2; c += 1) {
      let high = -99999;
      for (let dr = 0; dr < every; dr += 1) {
        for (let dc = 0; dc < every; dc += 1) high = Math.max(high, z[(r * every + dr) * cols + c * every + dc]);
      }
      grid[(r + 1) * w + c + 1] = high;
    }
  }
  return { grid, w, h, every };
}

/**
 * The rings where the grid crosses `level`, in grid positions.
 *
 * @param {{ grid: Float32Array, w: number, h: number }} g
 * @param {number} level
 * @returns {[number, number][][]}
 */
function rings({ grid, w, h }, level) {
  const at = (/** @type {number} */ c, /** @type {number} */ r) => grid[r * w + c];
  // Each crossing is named by the cell edge it lies on, so two cells that
  // share an edge share the point: h<c>,<r> is the edge from (c, r) to
  // (c + 1, r), v<c>,<r> the edge from (c, r) to (c, r + 1).
  /** @type {Map<string, [number, number]>} */
  const points = new Map();
  const point = (/** @type {string} */ key) => {
    let found = points.get(key);
    if (found) return found;
    const [c, r] = key.slice(1).split(',').map(Number);
    const a = at(c, r);
    const b = key[0] === 'h' ? at(c + 1, r) : at(c, r + 1);
    const t = (level - a) / (b - a);
    found = key[0] === 'h' ? [c + t, r] : [c, r + t];
    points.set(key, found);
    return found;
  };
  /** @type {Map<string, string>} from one crossing to the next, with the high side on the left */
  const next = new Map();
  for (let r = 0; r < h - 1; r += 1) {
    for (let c = 0; c < w - 1; c += 1) {
      const tl = at(c, r) >= level ? 8 : 0;
      const tr = at(c + 1, r) >= level ? 4 : 0;
      const br = at(c + 1, r + 1) >= level ? 2 : 0;
      const bl = at(c, r + 1) >= level ? 1 : 0;
      const code = tl | tr | br | bl;
      if (code === 0 || code === 15) continue;
      const T = `h${c},${r}`;
      const B = `h${c},${r + 1}`;
      const L = `v${c},${r}`;
      const R = `v${c + 1},${r}`;
      const middle = (at(c, r) + at(c + 1, r) + at(c + 1, r + 1) + at(c, r + 1)) / 4 >= level;
      /** @type {[string, string][]} */
      const segments = {
        1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[R, T]], 6: [[B, T]], 7: [[L, T]], 8: [[T, L]],
        9: [[T, B]], 11: [[T, R]], 12: [[R, L]], 13: [[R, B]], 14: [[B, L]],
        5: middle ? [[L, T], [R, B]] : [[L, B], [R, T]],
        10: middle ? [[T, R], [B, L]] : [[T, L], [B, R]],
      }[code];
      for (const [from, to] of segments) next.set(from, to);
    }
  }
  /** @type {[number, number][][]} */
  const found = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const ring = [];
    let key = start;
    while (key && !seen.has(key)) {
      seen.add(key);
      ring.push(point(key));
      key = /** @type {string} */ (next.get(key));
    }
    if (ring.length > 2) found.push(ring);
  }
  return found;
}

/**
 * Douglas–Peucker simplification of a closed ring.
 *
 * @param {[number, number][]} points
 * @param {number} tolerance
 */
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  // A closed ring: split it at its farthest point from the first, so the two
  // halves each have distinct ends.
  let far = 0;
  let best = -1;
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  keep[far] = 1;
  const stack = [[0, far], [far, points.length - 1]];
  while (stack.length) {
    const [first, last] = /** @type {number[]} */ (stack.pop());
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    let index = -1;
    let most = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / length;
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

/** @param {[number, number][]} ring */
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
 * The bands of a grid: for each level, one path of rings in map units.
 *
 * @param {Grid} grid
 * @param {{ every: number, tolerance: number, minArea: number, decimals: number }} options
 */
function bandsOf(grid, { every, tolerance, minArea, decimals }) {
  const g = coarse(grid, every);
  // Grid positions to map units: the coarse grid has a border of one cell.
  const toMap = (/** @type {number} */ c, /** @type {number} */ r) =>
    project(grid.west + ((c - 1) * every + (every - 1) / 2) * grid.step, grid.top - ((r - 1) * every + (every - 1) / 2) * grid.step);
  return LEVELS.map((level) => {
    const parts = [];
    for (const ring of rings(g, level)) {
      const mapped = ring.map(([c, r]) => {
        const { x, y } = toMap(c, r);
        return /** @type {[number, number]} */ ([x, y]);
      });
      const simple = simplify(mapped, tolerance);
      if (simple.length < 3 || area(simple) < minArea) continue;
      const inside = simple.filter(([x, y]) => x > -2 && x < WIDTH + 2 && y > -2 && y < HEIGHT + 2);
      if (!inside.length) continue;
      parts.push(`M${simple.map(([x, y]) => `${x.toFixed(decimals)} ${y.toFixed(decimals)}`).join('L')}Z`);
    }
    console.log(`${level} m: ${parts.length} rings`);
    return parts.join('');
  });
}

const bands = bandsOf(main, { every: CONTOUR_STEP, tolerance: TOLERANCE, minArea: MIN_AREA, decimals: 1 });

await mkdir(path.dirname(dataOut), { recursive: true });

// ---- The hill shade ----

/**
 * A hill shade of a box of the map: west, north, east, south in degrees, at
 * `perUnit` pixels a map unit. It returns the pixel rows, each with the PNG
 * filter byte in front, and where the image goes on the map.
 *
 * @param {Grid} grid
 * @param {[number, number, number, number]} box
 * @param {number} perUnit
 */
function hillShade({ z, rows, cols, top, step, west }, box, perUnit) {
  const corner = project(box[0], box[1]);
  const far = project(box[2], box[3]);
  const width = Math.round((far.x - corner.x) * perUnit);
  const height = Math.round((far.y - corner.y) * perUnit);
  // Grid cells for each pixel, and the first cell of the box.
  const c0 = (box[0] - west) / step;
  const r0 = (top - box[1]) / step;
  const cx = (box[2] - box[0]) / step / width;
  const cy = (box[1] - box[3]) / step / height;
  // The elevation at each pixel: the mean of the cells under it, or the
  // nearest cell where a pixel is smaller than a cell. The sea counts as
  // flat: the map draws it flat.
  const sampled = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const ra = Math.floor(r0 + y * cy);
    const rb = Math.max(ra + 1, Math.floor(r0 + (y + 1) * cy));
    for (let x = 0; x < width; x += 1) {
      const ca = Math.floor(c0 + x * cx);
      const cb = Math.max(ca + 1, Math.floor(c0 + (x + 1) * cx));
      let sum = 0;
      let n = 0;
      for (let r = Math.max(0, ra); r < rb && r < rows; r += 1) {
        for (let c = Math.max(0, ca); c < cb && c < cols; c += 1) {
          sum += Math.max(z[r * cols + c], 0);
          n += 1;
        }
      }
      sampled[y * width + x] = n ? sum / n : 0;
    }
  }
  // The size of a pixel on the ground, in metres: the map's scale is the
  // same both ways at its middle latitude.
  const metres = (KM_PER_UNIT * 1000) / perUnit;
  const zenith = ((90 - ALTITUDE) * Math.PI) / 180;
  const azimuth = ((360 - AZIMUTH + 90) * Math.PI) / 180;
  const flat = Math.cos(zenith);
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const e = (/** @type {number} */ dx, /** @type {number} */ dy) =>
        sampled[Math.min(height - 1, Math.max(0, y + dy)) * width + Math.min(width - 1, Math.max(0, x + dx))];
      // Horn's method, as GDAL's hill shade.
      const dzdx = (e(1, -1) + 2 * e(1, 0) + e(1, 1) - (e(-1, -1) + 2 * e(-1, 0) + e(-1, 1))) / (8 * metres);
      const dzdy = (e(-1, 1) + 2 * e(0, 1) + e(1, 1) - (e(-1, -1) + 2 * e(0, -1) + e(1, -1))) / (8 * metres);
      const slope = Math.atan(EXAGGERATION * Math.hypot(dzdx, dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);
      const shade = Math.cos(zenith) * Math.cos(slope) + Math.sin(zenith) * Math.sin(slope) * Math.cos(azimuth - aspect);
      // 128 is flat ground; the difference from flat makes the light and dark.
      raw[y * (width + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(128 + (shade - flat) * 360)));
    }
  }
  return { width, height, raw, at: { x: corner.x, y: corner.y, w: far.x - corner.x, h: far.y - corner.y } };
}

/** A gray PNG, 8 bits a pixel. @param {number} width @param {number} height @param {Buffer} raw rows, each with its filter byte */
function png(width, height, raw) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (/** @type {Buffer} */ data) => {
    let c = 0xffffffff;
    for (const byte of data) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (/** @type {string} */ type, /** @type {Buffer} */ data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The rows with the "up" filter: each row as its difference from the row
 * above, which packs smooth relief far better.
 *
 * @param {Buffer} raw
 * @param {number} width
 * @param {number} height
 */
function upFilter(raw, width, height) {
  const out = Buffer.alloc(raw.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width + 1);
    out[row] = y === 0 ? 0 : 2;
    for (let x = 1; x <= width; x += 1) {
      out[row + x] = y === 0 ? raw[row + x] : (raw[row + x] - raw[row - (width + 1) + x]) & 0xff;
    }
  }
  return out;
}

// The whole map, and the Levant in detail for a close view.
const levant = levantSource ? await loadGrid(levantSource) : main;
// The Levant's own contours, for a close view: every cell, simplified to
// about 150 m. Their rings close at the edge of the Levant's box, which is
// wider than any view that uses them.
const levantBands = levantSource ? bandsOf(levant, { every: 1, tolerance: 0.05, minArea: 0.02, decimals: 2 }) : [];
/** @type {{ name: string, grid: Grid, box: [number, number, number, number], perUnit: number }[]} */
const SHADES = [
  { name: 'hillshade', grid: main, box: [BOUNDS.west, BOUNDS.north, BOUNDS.east, BOUNDS.south], perUnit: SHADE_PIXELS },
  { name: 'hillshade-levant', grid: levant, box: LEVANT, perUnit: levantSource ? 8 : 4 },
];
await mkdir(path.dirname(imageOut), { recursive: true });
/** @type {Record<string, { x: number, y: number, w: number, h: number }>} */
const shades = {};
for (const { name, grid, box, perUnit } of SHADES) {
  const { width, height, raw, at } = hillShade(grid, box, perUnit);
  const file = path.join(path.dirname(imageOut), `${name}.png`);
  await writeFile(file, png(width, height, upFilter(raw, width, height)));
  shades[name] = { x: Number(at.x.toFixed(2)), y: Number(at.y.toFixed(2)), w: Number(at.w.toFixed(2)), h: Number(at.h.toFixed(2)) };
  console.log(`Hill shade ${width} × ${height} written to ${file}`);
}
await writeFile(dataOut, `${JSON.stringify({ levels: LEVELS, bands, levant: { box: LEVANT, bands: levantBands }, shades })}\n`);
console.log(`Bands written to ${dataOut}`);
