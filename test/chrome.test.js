import assert from 'node:assert/strict';
import test from 'node:test';
import { defaults, layout, nearestEdge, parseSettings } from '../app/lib/chrome.js';

/** @param {Partial<import('../app/lib/chrome.js').LayoutInput>} over */
const input = (over = {}) => ({
  width: 1600,
  height: 1000,
  gap: 10,
  phone: false,
  edge: /** @type {const} */ ('left'),
  rail: { w: 70, h: 500 },
  search: { open: true, float: null, expanded: false, w: 400, h: 60 },
  timeline: { open: true, float: null, w: 1200, h: 90 },
  tools: { open: false, float: null, w: 500, h: 600, anchor: { x: 45, y: 400 } },
  ...over,
});

test('settings from storage keep what is right and default the rest', () => {
  assert.deepEqual(parseSettings(null), defaults());
  const settings = parseSettings({ edge: 'top', size: 'xl', hidden: true, float: { search: { x: 5, y: 6 }, timeline: { x: 'a' } } });
  assert.equal(settings.edge, 'top');
  assert.equal(settings.size, 'm');
  assert.equal(settings.hidden, true);
  assert.deepEqual(settings.float, { search: { x: 5, y: 6 }, timeline: null, tools: null });
});

test('a dragged rail goes to the nearest edge', () => {
  assert.equal(nearestEdge({ x: 20, y: 500 }, 1600, 1000), 'left');
  assert.equal(nearestEdge({ x: 1590, y: 500 }, 1600, 1000), 'right');
  assert.equal(nearestEdge({ x: 800, y: 980 }, 1600, 1000), 'bottom');
  assert.equal(nearestEdge({ x: 800, y: 5 }, 1600, 1000), 'top');
});

test('a left rail: the search beside it, the timeline along the bottom, the cards between', () => {
  const placed = layout(input());
  assert.deepEqual(placed.rail, { x: 10, y: 10, w: 70, h: null });
  // Beside the rail, at rest as tall as its field.
  assert.deepEqual(placed.search, { x: 90, y: 10, w: 400, h: null });
  // From the rail to the right edge, at the bottom.
  assert.deepEqual(placed.timeline, { x: 90, y: 900, w: 1500, h: null });
  assert.deepEqual(placed.free, { left: 500, top: 10, right: 1590, bottom: 890 });
  // Open with an answer, the search reaches down to the timeline.
  const open = layout(input({ search: { open: true, float: null, expanded: true, w: 400, h: 60 } }));
  assert.equal(open.search?.h, 880);
});

test('a right rail mirrors it, and a top rail puts the timeline under it', () => {
  const right = layout(input({ edge: 'right' }));
  assert.equal(right.rail.x, 1600 - 10 - 70);
  assert.equal(right.search?.x, 1600 - 2 * 10 - 70 - 400);
  assert.equal(right.free.right, right.search.x - 10);
  const top = layout(input({ edge: 'top', rail: { w: 700, h: 70 } }));
  assert.deepEqual(top.rail, { x: 10, y: 10, w: 700, h: null });
  assert.equal(top.timeline?.y, 90);
  assert.equal(top.search?.y, 90 + 90 + 10);
});

test('a bottom rail keeps the field at rest low, near it', () => {
  const placed = layout(input({ edge: 'bottom', rail: { w: 700, h: 70 } }));
  assert.equal(placed.rail.y, 1000 - 10 - 70);
  assert.equal(placed.timeline?.y, 1000 - 2 * 10 - 70 - 90);
  assert.equal(placed.search?.y, (placed.timeline?.y ?? 0) - 10 - 60);
});

test('the tools open beside their button, and a floating panel stays on the screen', () => {
  const placed = layout(input({ tools: { open: true, float: null, w: 500, h: 600, anchor: { x: 45, y: 700 } } }));
  // Beside the rail, moved up so all of it fits.
  assert.deepEqual(placed.tools, { x: 90, y: 1000 - 10 - 600, w: 500, h: null });
  const floating = layout(input({ search: { open: true, float: { x: 5000, y: -40 }, expanded: false, w: 400, h: 60 } }));
  assert.deepEqual(floating.search, { x: 1200, y: 0, w: 400, h: null });
  // A floating search leaves the column beside the rail to the cards.
  assert.equal(floating.free.left, 90);
});

test('on a phone the rail is at the bottom, the width of the screen, and nothing floats', () => {
  const placed = layout(input({ phone: true, edge: 'left', width: 400, height: 800, rail: { w: 380, h: 60 }, search: { open: true, float: { x: 50, y: 50 }, expanded: true, w: 400, h: 60 } }));
  assert.deepEqual(placed.rail, { x: 10, y: 800 - 10 - 60, w: 380, h: null });
  assert.deepEqual(placed.search, { x: 10, y: 10, w: 380, h: 800 - 2 * 10 - 60 - 10 });
  assert.equal(placed.timeline?.w, 380);
});

test("the chrome keeps clear of a phone's notch and home bar; the table runs under them", () => {
  const safe = { top: 47, right: 0, bottom: 34, left: 0 };
  const placed = layout(input({ phone: true, width: 400, height: 800, rail: { w: 380, h: 60 }, safe, search: { open: true, float: null, expanded: true, w: 400, h: 60 } }));
  // The rail above the home bar; the search below the notch.
  assert.equal(placed.rail.y, 800 - 34 - 10 - 60);
  assert.equal(placed.search?.y, 47 + 10);
  assert.equal((placed.search?.y ?? 0) + (placed.search?.h ?? 0), placed.rail.y - 10);
  // In landscape, the notch at the side.
  const side = layout(input({ safe: { top: 0, right: 0, bottom: 21, left: 59 } }));
  assert.equal(side.rail.x, 59 + 10);
  assert.equal(side.search?.x, 59 + 10 + 70 + 10);
  assert.equal(side.free.left, (side.search?.x ?? 0) + (side.search?.w ?? 0) + 10);
  // A floating panel stays inside the safe area.
  const floating = layout(input({ safe: { top: 47, right: 0, bottom: 0, left: 0 }, search: { open: true, float: { x: 300, y: 0 }, expanded: false, w: 400, h: 60 } }));
  assert.equal(floating.search?.y, 47);
});
