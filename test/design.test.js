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
  const found = Object.fromEntries(pairs.map((m) => [m[1], m[2 + side]]));
  // A token can name another: --paper: var(--paper-soft).
  for (const m of body.matchAll(/--([\w-]+):\s*var\(--([\w-]+)\);/g)) found[m[1]] = `var:${m[2]}`;
  return found;
}

/** Each token as a color, with its var() names followed. @param {Record<string, string>} palette */
function resolved(palette) {
  return Object.fromEntries(
    Object.entries(palette).map(([key, value]) => {
      let color = value;
      while (color?.startsWith('var:')) color = palette[color.slice(4)];
      return [key, color];
    }),
  );
}

const SOFT = ":root[data-paper='soft']";
const LAMP = ":root[data-paper='lamp']";
const settings = Object.fromEntries(
  /** @type {[string, 0 | 1][]} */ ([['day', 0], ['night', 1]]).flatMap(([theme, side]) => {
    const bright = tokens(':root', side);
    return [
      [`${theme}, bright`, resolved(bright)],
      [`${theme}, soft`, resolved({ ...bright, ...tokens(SOFT, side) })],
      [`${theme}, lamp`, resolved({ ...bright, ...tokens(LAMP, side) })],
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
    // A field's edge shows where to type: 3:1 by WCAG 2 (1.4.11).
    assert.ok(wcag(palette['field-edge'], palette.paper) >= 3, `field edge ${palette['field-edge']} on ${palette.paper}: ${wcag(palette['field-edge'], palette.paper).toFixed(2)}:1`);
  });
}

/**
 * The WCAG 2 contrast ratio of two colors.
 *
 * @param {string} a @param {string} b such as #fcf9f2
 */
function wcag(a, b) {
  /** @param {string} hex */
  const luminance = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('the table and the design page set the reader\'s settings and the rem with the same script', async () => {
  const { readFile } = await import('node:fs/promises');
  /** @param {string} file */
  const script = async (file) => {
    const html = await readFile(new URL(`../app/routes/${file}`, import.meta.url), 'utf8');
    return /<script>\s*try \{[\s\S]*?<\/script>/.exec(html)?.[0] ?? '';
  };
  const table = await script('table.html');
  assert.match(table, /applyInterfaceSize/);
  assert.equal(await script('design.html'), table);
});
