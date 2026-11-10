// A word of the original languages typed as it is said, such as agape,
// chesed or shalom, to its Strong's number. Strong's dictionary writes
// each word in its own transliteration (agápē, chêçêd, shâlôwm), so both
// it and what is typed are brought to one plain spelling first.

/**
 * The plain spelling of a transliteration: no accents or breathings, lower
 * case, and the usual variants made one: ch and kh as h, th as t, c as s,
 * ow as o, iy as i, uw as u, q as k, tz as ts, and a doubled letter as
 * one.
 *
 * @param {string} text
 */
export function plain(text) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ʼʻ'’`\-\s.]/g, '')
    .replace(/kh|ch/g, 'h')
    .replace(/th/g, 't')
    .replace(/c/g, 's')
    .replace(/ow/g, 'o')
    .replace(/iy/g, 'i')
    .replace(/uw/g, 'u')
    .replace(/q/g, 'k')
    .replace(/tz/g, 'ts')
    .replace(/(.)\1+/g, '$1');
}

/**
 * An index of plain spellings to Strong's numbers. A Greek word is also
 * found with u for y (kurios, kyrios).
 *
 * @param {Record<string, { xlit: string }>} lexicon
 * @returns {Map<string, string[]>}
 */
export function lemmaIndex(lexicon) {
  /** @type {Map<string, string[]>} */
  const index = new Map();
  const add = (/** @type {string} */ key, /** @type {string} */ code) => {
    if (!key) return;
    const list = index.get(key) ?? [];
    if (!list.includes(code)) list.push(code);
    index.set(key, list);
  };
  for (const [code, entry] of Object.entries(lexicon)) {
    const key = plain(entry.xlit ?? '');
    add(key, code);
    if (code.startsWith('G')) add(key.replace(/y/g, 'u'), code);
  }
  return index;
}

// Names the dictionary spells otherwise than people say them.
/** @type {Record<string, string>} */
export const SAID = { yahweh: 'H3068', jehovah: 'H3068', yhwh: 'H3068', adonai: 'H136', hesed: 'H2617' };
