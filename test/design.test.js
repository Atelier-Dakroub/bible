import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { contrast } from '../app/lib/apca.js';

// The reading room's colors, read from the stylesheet itself, so the test
// checks what the page shows.
const css = readFileSync(new URL('../app/styles/reading-room.css', import.meta.url), 'utf8');

/** @param {string} selector */
function tokens(selector) {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `no rule for ${selector}`);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6});/gi)].map((m) => [m[1], m[2]]));
}

const day = tokens('.rr');
const night = { ...day, ...tokens(":root[data-theme='night'] .rr") };
const settings = {
  'day, bright': day,
  'day, soft': { ...day, ...tokens(":root[data-paper='soft'] .rr") },
  'day, lamp': { ...day, ...tokens(":root[data-paper='lamp'] .rr") },
  'night, bright': night,
  'night, soft': { ...night, ...tokens(":root[data-theme='night'][data-paper='soft'] .rr") },
  'night, lamp': { ...night, ...tokens(":root[data-theme='night'][data-paper='lamp'] .rr") },
};

// What each token is, and the APCA contrast it needs on the paper.
const NEEDS = {
  ink: 75,
  rubric: 75,
  'ink-soft': 60,
  lapis: 60,
  ochre: 60,
  verdigris: 60,
  slate: 60,
  purple: 60,
  edge: 15,
};

for (const [name, palette] of Object.entries(settings)) {
  test(`the reading room's colors are readable: ${name}`, () => {
    for (const [token, needs] of Object.entries(NEEDS)) {
      const lc = Math.abs(contrast(palette[token], palette.paper));
      assert.ok(lc >= needs, `${token} ${palette[token]} on ${palette.paper}: Lc ${lc.toFixed(1)}, needs ${needs}`);
    }
    // The text on a fill: a chip, a highlight, a tab.
    assert.ok(Math.abs(contrast(palette.ink, palette.tint)) >= 75, 'ink on tint');
    assert.ok(Math.abs(contrast(palette.ink, palette.wash)) >= 75, 'ink on a highlight');
    assert.ok(Math.abs(contrast(palette['on-pigment'], palette.lapis)) >= 60, 'a pressed button');
  });
}
