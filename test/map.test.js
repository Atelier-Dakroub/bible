import assert from 'node:assert/strict';
import test from 'node:test';
import { mapOf } from '../app/data/entities.js';
import {
  HEIGHT,
  KM_PER_UNIT,
  LEVELS,
  MAX_ZOOM,
  WIDTH,
  clampView,
  fitView,
  levelOf,
  moveView,
  nameLevels,
  project,
  scaleBar,
  wholeMap,
  zoomOf,
} from '../app/lib/map.js';
import { parse } from '../app/lib/workspace.js';

const close = (a, b, within = 1e-6) => assert.ok(Math.abs(a - b) <= within, `${a} is not ${b}`);

test('a view stays inside the map and the zoom limits', () => {
  assert.deepEqual(clampView({ x: -50, y: -50, w: WIDTH * 2 }), wholeMap());
  const close16 = clampView({ x: WIDTH, y: HEIGHT, w: 1 });
  close(close16.w, WIDTH / MAX_ZOOM);
  close(close16.x, WIDTH - close16.w);
  close(close16.y, HEIGHT - (close16.w * HEIGHT) / WIDTH);
});

test('a pinch keeps the map point under the fingers', () => {
  const view = { x: 200, y: 100, w: 400 };
  const at = { x: 0.25, y: 0.2 };
  const under = { x: view.x + at.x * view.w, y: view.y + at.y * view.w };
  const after = moveView(view, at, at, 2);
  close(after.w, 200);
  close(after.x + at.x * after.w, under.x);
  close(after.y + at.y * after.w, under.y);
  assert.equal(zoomOf(after), WIDTH / 200);
});

test('a drag moves the map with the finger', () => {
  const view = { x: 400, y: 200, w: 400 };
  const after = moveView(view, { x: 0.5, y: 0.3 }, { x: 0.4, y: 0.3 }, 1);
  close(after.x, 440);
  close(after.y, 200);
});

test('a fit shows every point, and one point not too close', () => {
  const jerusalem = project(35.23, 31.78);
  const babylon = project(44.42, 32.54);
  const both = fitView([jerusalem, babylon]);
  for (const point of [jerusalem, babylon]) {
    assert.ok(point.x > both.x && point.x < both.x + both.w);
    assert.ok(point.y > both.y && point.y < both.y + (both.w * HEIGHT) / WIDTH);
  }
  close(fitView([jerusalem]).w, WIDTH / 6);
  assert.deepEqual(fitView([]), wholeMap());
});

test('levels follow the zoom', () => {
  assert.equal(levelOf(1), 0);
  assert.equal(levelOf(1.9), 0);
  assert.equal(levelOf(2), 1);
  assert.equal(levelOf(MAX_ZOOM), LEVELS.length - 1);
});

test('names do not cover each other, and closer in there are more', () => {
  const places = [
    { x: 100, y: 100, chars: 9 },
    { x: 100, y: 110, chars: 9 },
    { x: 400, y: 400, chars: 9 },
  ];
  const levels = nameLevels(places, 0.66, { font: 18, gap: 8 });
  assert.equal(levels[0], 0);
  assert.equal(levels[2], 0);
  assert.ok(levels[1] > 0 && levels[1] < LEVELS.length, `the second name waits for room: ${levels[1]}`);
});

test('the most named places are named at the whole map', async () => {
  const map = await mapOf();
  const order = [...map.places].reverse();
  const levels = nameLevels(
    order.map((place) => ({ x: Number(place.x), y: Number(place.y), chars: place.name.length })),
    1056 / WIDTH,
    { font: 18, gap: 8 },
  );
  const named = order.filter((_, i) => levels[i] === 0).map((place) => place.name);
  assert.ok(named.includes('Jerusalem'));
  assert.ok(named.includes('Egypt'));
  assert.ok(named.length < 80, `${named.length} names at the whole map`);
  assert.ok(levels.filter((level) => level <= 3).length > named.length * 4);
});

test('the scale bar is a round distance that fits', () => {
  const bar = scaleBar(1 / KM_PER_UNIT * 0.66);
  assert.ok([100, 200, 500].includes(bar.km), String(bar.km));
  assert.ok(bar.px <= 160);
  assert.match(scaleBar(10).label, /^10 km \(6\.2 mi\)$/);
});

test('a workspace keeps the map view, and drops a bad one', () => {
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const kept = parse(
    JSON.stringify({
      cards: [
        { id: 'm', address: 'map:near-east', matrix, view: { x: 10, y: 20, w: 300 } },
        { id: 'n', address: 'map:near-east', matrix, view: { x: 'a', y: 0, w: 1 } },
      ],
    }),
  );
  assert.deepEqual(kept.cards[0].view, { x: 10, y: 20, w: 300 });
  assert.equal(kept.cards[1].view, undefined);
});

test('the relief has a band for each level, and its images lie on the map', async () => {
  const { default: relief } = await import('../app/data/map/relief.json', { with: { type: 'json' } });
  assert.deepEqual(relief.levels, [200, 500, 1000, 1500, 2000, 3000]);
  assert.equal(relief.bands.length, relief.levels.length);
  assert.equal(relief.levant.bands.length, relief.levels.length);
  for (const d of [...relief.bands, ...relief.levant.bands]) assert.match(d, /^M[\d.-]+ [\d.-]+L/);
  for (const box of Object.values(relief.shades)) {
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= WIDTH + 0.01 && box.y + box.h <= HEIGHT + 1, JSON.stringify(box));
  }
});

test('the ancient world: seven extents and the shores of four ages, each a path on the map', async () => {
  const { default: ancient } = await import('../app/data/map/ancient.json', { with: { type: 'json' } });
  assert.deepEqual(ancient.layers.map((layer) => layer.id), ['persia', 'alexander', 'hasmonean', 'rome-60', 'herod', 'rome-117', 'provinces-200']);
  assert.deepEqual(ancient.shores.map((shore) => shore.id), ['archaic', 'classical', 'hellenistic', 'roman']);
  for (const each of [...ancient.layers, ...ancient.shores]) assert.match(each.d, /^M[\d.-]+ [\d.-]+L/);
  assert.match(ancient.license, /ODbL/);
});

test('the waters are named on the water, at levels the map has, and stand for places it has', async () => {
  const { waters } = await import('../app/data/map/waters.js');
  const { books, passage } = await import('../app/data/bible.js');
  const { parseAddress } = await import('../app/lib/reference.js');
  const map = await mapOf();
  assert.equal(map.waters.length, waters.length);
  const ids = new Set(map.places.map((place) => place.id));
  for (const water of waters) {
    assert.ok(water.levels[0] <= water.levels[1] && water.levels[1] < LEVELS.length, water.name);
    for (const id of [water.place, ...(water.also ?? [])].filter(Boolean)) assert.ok(ids.has(id), `${water.name}: ${id}`);
    if (water.ref) {
      const ref = parseAddress(water.ref, books);
      assert.ok(ref && (await passage(ref)).verses.length === 1, `${water.name}: ${water.ref}`);
    }
  }
  // A water's own dot is marked, so that the map hides it until a card names it.
  assert.ok(map.places.find((place) => place.id === 'place:salt_sea_1021')?.water);
  assert.ok(!map.places.find((place) => place.id === 'place:jerusalem_636')?.water);
  const dead = map.waters.find((water) => water.name === 'Dead Sea');
  assert.equal(dead?.bible, 'the Salt Sea');
});
