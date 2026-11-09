import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { contrast } from '../app/lib/apca.js';

// The reading room's colors, read from the stylesheet itself, so the test
// checks what the page shows.
const css = readFileSync(new URL('../app/styles/reading-room.css', import.meta.url), 'utf8');

/**
 * The colors a rule sets, for day or for night: each token is
 * light-dark(day, night).
 *
 * @param {string} selector
 * @param {0 | 1} side 0 for day, 1 for night
 */
function tokens(selector, side) {
  const at = css.indexOf(`${selector} {`);
  assert.ok(at >= 0, `no rule for ${selector}`);
  const body = css.slice(at, css.indexOf('}', at));
  const pairs = [...body.matchAll(/--([\w-]+):\s*light-dark\((#[0-9a-f]{3,6}),\s*(#[0-9a-f]{3,6})\);/gi)];
  return Object.fromEntries(pairs.map((m) => [m[1], m[2 + side]]));
}

const SOFT = ":root[data-paper='soft']";
const LAMP = ":root[data-paper='lamp']";
const settings = Object.fromEntries(
  /** @type {[string, 0 | 1][]} */ ([['day', 0], ['night', 1]]).flatMap(([theme, side]) => {
    const bright = tokens(':root', side);
    return [
      [`${theme}, bright`, bright],
      [`${theme}, soft`, { ...bright, ...tokens(SOFT, side) }],
      [`${theme}, lamp`, { ...bright, ...tokens(LAMP, side) }],
    ];
  }),
);

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
