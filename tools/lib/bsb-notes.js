// The BSB's footnotes, kept through tools/import-bsb.js.
//
// While the USFM lines are read, each footnote is held in the text as a mark
// that no marker pattern touches, with its number in the book's list. When a
// verse's blocks are done, the marks come out, each noted at the place in the
// text it follows. The text is then the same as with no footnotes at all.

/** The two ends of a held footnote. */
export const OPEN = '\uE000';
export const CLOSE = '\uE001';
const HELD = new RegExp(`${OPEN}(\\d+)${CLOSE}`);

/**
 * A footnote's words: `\f + \fr 1:14 \ft Or and tabernacled among us\f*`
 * gives "Or and tabernacled among us". The reference says the verse the note
 * is already in.
 *
 * @param {string} footnote
 */
export function footnoteText(footnote) {
  return footnote
    .replace(/^\\f\s+\S+\s*/, '')
    .replace(/\\fr\s+[^\\]*/, '')
    .replace(/\\f\*$/, '')
    .replace(/\\\+?[a-z]+\d?\*?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Takes the held footnotes out of a block's text, each noted at the place it
 * follows. A space on both sides of one becomes a single space, so the text
 * is the same as with no footnotes at all.
 *
 * @param {string} text
 * @param {string[]} footnotes the book's, by number
 * @returns {{ text: string, notes: { at: number, text: string }[] }}
 */
export function takeNotes(text, footnotes) {
  const notes = [];
  let rest = text;
  for (let match = HELD.exec(rest); match; match = HELD.exec(rest)) {
    let before = rest.slice(0, match.index);
    let after = rest.slice(match.index + match[0].length);
    if (before === '') after = after.trimStart();
    else if (/^\s|^$/.test(after)) before = before.trimEnd();
    notes.push({ at: before.length, text: footnotes[Number(match[1])] });
    rest = before + after;
  }
  return { text: rest, notes };
}

/**
 * A verse's blocks with their footnotes taken out. A block that was only a
 * footnote gives it to the block before.
 *
 * @param {{ style: string, text: string, notes?: { at: number, text: string }[] }[]} blocks
 * @param {string[]} footnotes
 */
export function withNotes(blocks, footnotes) {
  /** @type {typeof blocks} */
  const kept = [];
  for (const block of blocks) {
    const { text, notes } = takeNotes(block.text, footnotes);
    const last = kept.at(-1);
    if (!text && last) {
      last.notes = [...(last.notes ?? []), ...notes.map((note) => ({ ...note, at: last.text.length }))];
      continue;
    }
    kept.push(notes.length ? { style: block.style, text, notes } : { style: block.style, text });
  }
  return kept;
}
