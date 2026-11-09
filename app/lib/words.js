// Word addresses and highlights.
//
// A word's address is its verse's address and its number in the verse:
// `JHN.3.16.w3` is the third word of John 3:16. A highlight is a span from one
// word address to another, stored apart from the text. Every card that holds
// any of those words shows the highlight, so the same words highlighted on one
// card are highlighted on all of them.
//
// A word is a run of text that holds a letter or a digit, with the space after
// it. Punctuation that touches a word belongs to it; a comma or a paragraph
// mark on its own does not count. The numbers therefore stay the same for as
// long as the text does.

/** @typedef {{ from: string, to: string, style?: string }} Highlight `style` is one of STYLES; none is the first */

// How a highlight is drawn. Inverse is the default, and is not stored. The
// three differ in shape, not in color, so each can mean something of its own.
export const STYLES = ['inverse', 'underline', 'box'];

const BOOKS = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH',
  'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS',
  'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK',
  'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT',
  'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
];

const WORD_ADDRESS = /^([1-3]?[A-Z]{2,3})\.(\d+)\.(\d+)\.w(\d+)$/;
const TOKEN = /\s+|\S+\s*/g;
const HAS_LETTER = /[\p{L}\p{N}]/u;

/**
 * Splits a run of text into tokens, numbering the words from `next`.
 *
 * @param {string} text
 * @param {number} next the number the first word in this text gets
 * @returns {{ tokens: { text: string, w: number }[], next: number }} `w` is 0 for a token that is not a word
 */
export function tokenize(text, next) {
  const tokens = [];
  for (const [piece] of text.matchAll(TOKEN)) {
    if (HAS_LETTER.test(piece)) {
      tokens.push({ text: piece, w: next });
      next += 1;
    } else {
      tokens.push({ text: piece, w: 0 });
    }
  }
  return { tokens, next };
}

/**
 * A number that sorts word addresses in canon order, or NaN for an address
 * that is not one. Chapters stop at 150, verses at 176, and no verse has a
 * thousand words, so each part fits its place.
 *
 * @param {string} address
 */
export function wordKey(address) {
  const match = WORD_ADDRESS.exec(address);
  if (!match) return NaN;
  const book = BOOKS.indexOf(match[1]);
  if (book < 0) return NaN;
  return ((book * 1000 + Number(match[2])) * 1000 + Number(match[3])) * 1000 + Number(match[4]);
}

/** @param {string} address */
export function isWordAddress(address) {
  return !Number.isNaN(wordKey(address));
}

/**
 * A span as one address, for a card that holds only those words:
 * `JHN.3.16.w3-JHN.3.16.w9`.
 *
 * @param {Highlight} range
 */
export function spanAddress(range) {
  return `${range.from}-${range.to}`;
}

/**
 * The span a span address names, in reading order, or null. Both ends must be
 * in the same book.
 *
 * @param {string} address
 * @returns {Highlight | null}
 */
export function parseSpanAddress(address) {
  const [a, b, rest] = address.split('-');
  if (rest !== undefined || !isWordAddress(a ?? '') || !isWordAddress(b ?? '')) return null;
  if (a.split('.')[0] !== b.split('.')[0]) return null;
  return span(a, b);
}

/**
 * The span with its ends in reading order.
 *
 * @param {string} a
 * @param {string} b
 * @returns {Highlight}
 */
export function span(a, b) {
  return wordKey(a) <= wordKey(b) ? { from: a, to: b } : { from: b, to: a };
}

/**
 * @param {Highlight} range
 * @param {string} address
 */
export function covers(range, address) {
  const key = wordKey(address);
  return key >= wordKey(range.from) && key <= wordKey(range.to);
}

/**
 * What one marking gesture does to the highlights. A tap on a highlighted word
 * removes every highlight under it. Marking a span that is already exactly a
 * highlight removes it when the style is the same, and gives it the new style
 * when it is not. Anything else adds the span.
 *
 * @param {Highlight[]} list
 * @param {string} a where the finger went down
 * @param {string} b where it came up
 * @param {string} [style] the style of a new highlight
 * @returns {Highlight[]}
 */
export function toggle(list, a, b, style = STYLES[0]) {
  const range = span(a, b);
  if (range.from === range.to) {
    const under = list.filter((each) => covers(each, range.from));
    if (under.length) return list.filter((each) => !under.includes(each));
  }
  const same = list.find((each) => each.from === range.from && each.to === range.to);
  if (same && (same.style ?? STYLES[0]) === style) return list.filter((each) => each !== same);
  const added = style === STYLES[0] ? range : { ...range, style };
  if (same) return list.map((each) => (each === same ? added : each));
  return [...list, added];
}

/**
 * The address of the word an element is in, or null.
 *
 * @param {Element | null} element
 */
export function wordAt(element) {
  const word = element?.closest('[data-w]');
  const verse = word?.closest('[data-ref]');
  if (!(word instanceof HTMLElement) || !(verse instanceof HTMLElement)) return null;
  return `${verse.dataset.ref}.w${word.dataset.w}`;
}

/**
 * Sets `name` on each word inside `root` that a range covers.
 *
 * @param {Element} root
 * @param {Highlight[]} ranges
 * @param {string} name the class to set
 */
export function paintWords(root, ranges, name) {
  for (const word of root.querySelectorAll('[data-w]')) {
    const address = wordAt(word);
    word.classList.toggle(name, Boolean(address) && ranges.some((range) => covers(range, /** @type {string} */ (address))));
  }
}

/**
 * Draws the highlights on each word inside `root`: `data-mark` is the style
 * of the latest highlight that covers the word, and `data-edge` says whether
 * the word starts or ends it (start, end or both), for the box style.
 *
 * @param {Element} root
 * @param {Highlight[]} highlights
 */
export function paintHighlights(root, highlights) {
  const ranges = highlights.map((each) => ({ from: wordKey(each.from), to: wordKey(each.to), each }));
  for (const word of root.querySelectorAll('[data-w]')) {
    const element = /** @type {HTMLElement} */ (word);
    const address = wordAt(word);
    const key = address ? wordKey(address) : NaN;
    let found = null;
    for (const range of ranges) if (key >= range.from && key <= range.to) found = range;
    if (!found) {
      if (element.dataset.mark) {
        delete element.dataset.mark;
        delete element.dataset.edge;
      }
      continue;
    }
    element.dataset.mark = found.each.style ?? STYLES[0];
    const start = key === found.from;
    const end = key === found.to;
    if (start || end) element.dataset.edge = start && end ? 'both' : start ? 'start' : 'end';
    else delete element.dataset.edge;
  }
}
