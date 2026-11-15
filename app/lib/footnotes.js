// The BSB's footnotes on a card: each on the word it follows, with a letter,
// a, b, c through the verse, as a printed BSB marks them.
//
// tools/import-bsb.js keeps a footnote as the place in a block's text that
// it follows ({ at, text }). A word's token carries the space after it
// ("us. "), so a token with a footnote inside shows in two parts: `head`
// before the mark and `tail` after it. Its `text` stays whole, as the code
// that joins a verse's tokens reads it. The word's address does not change,
// so highlights and links keep their words.

/** @typedef {{ at: number, text: string }} Footnote */
/** @typedef {{ text: string, label: string }} Mark */

/**
 * The letter of a verse's nth footnote, from 0.
 *
 * @param {number} n
 */
export function footnoteLabel(n) {
  return n < 26 ? String.fromCharCode(97 + n) : String(n + 1);
}

/**
 * A block's tokens with its footnotes on them.
 *
 * @template {{ text: string }} T
 * @param {T[]} tokens the block's, whose texts make its text
 * @param {Footnote[] | undefined} notes
 * @param {number} first the number of the verse's footnotes in the blocks before
 * @returns {{ tokens: (T & { notes?: Mark[], head?: string, tail?: string })[], next: number }}
 */
export function footnoted(tokens, notes, first) {
  if (!notes?.length) return { tokens, next: first };
  let next = first;
  let start = 0;
  const placed = tokens.map((token, i) => {
    const end = start + token.text.length;
    // The token that holds the character before the footnote; one at the
    // very start goes on the first token.
    const here = notes.filter((note) => (note.at > start && note.at <= end) || (i === 0 && note.at === 0));
    const from = start;
    start = end;
    if (!here.length) return token;
    const cut = Math.max(...here.map((note) => note.at)) - from;
    const marks = here.map((note) => ({ text: note.text, label: footnoteLabel(next++) }));
    if (cut <= 0 || cut >= token.text.length) return { ...token, notes: marks };
    return { ...token, notes: marks, head: token.text.slice(0, cut), tail: token.text.slice(cut) };
  });
  return { tokens: placed, next };
}

/**
 * What a footnote's popover says above the note: its verse and its letter.
 *
 * @param {{ ref?: string, bsbRef?: string }} verse the verse element's data
 *   (data-ref, or data-bsb-ref beside the KJV), such as JHN.1.14
 * @param {string} label
 */
export function footnoteTitle({ ref, bsbRef }, label) {
  const verse = /\.(\d+)$/.exec(ref ?? bsbRef ?? '')?.[1];
  return verse ? `Verse ${verse}, footnote ${label}` : `Footnote ${label}`;
}
