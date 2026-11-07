// Reads a KJV book in USFM into the app's verse records: blocks of runs.
//
// The source is eBible.org's eng-kjv2006 (public domain). A verse is a list of
// blocks; a block is a paragraph style and a list of runs; a run is text and
// the character styles it carries:
//
//   block styles  p prose, q1 poetry, d a psalm title, s1 a Psalm 119 letter
//                 heading, b a stanza break (no runs)
//   marks         add  words the translators supplied (printed in italics)
//                 nd   the divine name (LORD)
//                 wj   the words of Jesus
//                 tl   a transliterated letter, in the Psalm 119 headings
//
// Footnotes and Strong's attributes are left out here; tools/import-strongs.js
// reads the numbers. A psalm title or a letter heading comes before its verse
// in USFM and joins that verse, so a verse's text is all in its own record.
// The headings that close some epistles ("Written to the Romans from
// Corinthus...") are not verse text and are left out.

/** @typedef {{ text: string, marks: string[] }} Run */
/** @typedef {{ style: string, numbered?: true, runs: Run[] }} Block */
/** @typedef {{ n: number, id: string, blocks: Block[] }} Verse */

export const BLOCK_STYLES = new Set(['p', 'q1', 'd', 's1', 'b']);
export const MARKS = new Set(['add', 'nd', 'wj', 'tl']);

// An opening marker takes the one space after it: in USFM that space belongs
// to the marker, not to the text. A closing marker (\add*) takes none.
const MARKER = /\\(\+?)([a-z]+\d?)(\*| ?)/g;

/**
 * The runs of a piece of USFM text inside a verse or a title.
 *
 * @param {string} text
 * @param {string[]} open the marks open when the text starts; changed in place
 * @returns {Run[]}
 */
export function inlineRuns(text, open = []) {
  const plain = text
    .replace(/\\f .*?\\f\*/g, '')
    .replace(/\\(\+?)w\s+([^|\\]*?)\|[^\\]*?\\\+?w\*/g, '$2');
  /** @type {Run[]} */
  const runs = [];
  let last = 0;
  /** @param {string} piece */
  const add = (piece) => {
    const words = piece.replace(/\s+/g, ' ');
    if (!words) return;
    const previous = runs.at(-1);
    if (previous && previous.marks.join(' ') === open.join(' ')) previous.text += words;
    else runs.push({ text: words, marks: [...open] });
  };
  for (const match of plain.matchAll(MARKER)) {
    add(plain.slice(last, match.index));
    last = (match.index ?? 0) + match[0].length;
    const [, , name, end] = match;
    if (!MARKS.has(name)) throw new Error(`Unknown character style \\${name} in: ${text.slice(0, 80)}`);
    if (end === '*') {
      const at = open.lastIndexOf(name);
      if (at >= 0) open.splice(at, 1);
    } else {
      open.push(name);
    }
  }
  add(plain.slice(last));
  return runs;
}

/**
 * The verses of one book, by chapter.
 *
 * @param {string} usfm the whole file
 * @param {string} book the book id, such as GEN
 * @returns {{ n: number, verses: Verse[] }[]}
 */
export function readBook(usfm, book) {
  /** @type {{ n: number, verses: Verse[] }[]} */
  const chapters = [];
  /** @type {Verse | null} */
  let verse = null;
  /** @type {Block[]} blocks that come before the next verse: a title, a heading */
  let pending = [];
  let style = 'p';
  // A paragraph marker inside a verse starts a new block for the text after it.
  let fresh = false;
  /** @type {string[]} */
  const open = [];

  const lines = usfm.replace(/\\f .*?\\f\*/gs, '').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const [, marker = '', rest = ''] = /^\\([a-z]+\d?)\s*(.*)$/s.exec(line) ?? [];

    if (marker === 'c') {
      chapters.push({ n: Number.parseInt(rest, 10), verses: [] });
      verse = null;
      pending = [];
      continue;
    }
    if (['id', 'h', 'toc1', 'toc2', 'toc3', 'mt1', 'mt2'].includes(marker)) continue;
    if (marker === 'p' || marker === 'q1') {
      style = marker;
      fresh = true;
      if (rest) addText(rest);
      continue;
    }
    if (marker === 'b') {
      (verse ? verse.blocks : pending).push({ style: 'b', runs: [] });
      continue;
    }
    if (marker === 'd') {
      pending.push({ style: 'd', runs: inlineRuns(rest, open) });
      continue;
    }
    if (marker === 's1') {
      // In Psalm 119 a heading is a letter; elsewhere it closes an epistle.
      if (/\\tl\b/.test(rest)) pending.push({ style: 's1', runs: inlineRuns(rest, open) });
      continue;
    }
    if (marker === 'v') {
      addText(line);
      continue;
    }
    throw new Error(`Unknown line in ${book}: ${line.slice(0, 80)}`);
  }

  for (const chapter of chapters) {
    for (const each of chapter.verses) for (const block of each.blocks) trim(block);
  }
  return chapters;

  /** @param {string} text a line, or the rest of one, that may hold verse markers */
  function addText(text) {
    for (const piece of text.split(/(\\v\s+\d+\s?)/)) {
      const start = /^\\v\s+(\d+)\s?$/.exec(piece);
      if (start) {
        const chapter = chapters.at(-1);
        if (!chapter) throw new Error(`A verse before any chapter in ${book}`);
        const n = Number(start[1]);
        verse = { n, id: `${book}.${chapter.n}.${n}`, blocks: [...pending, { style, numbered: true, runs: [] }] };
        pending = [];
        fresh = false;
        chapter.verses.push(verse);
        continue;
      }
      const runs = inlineRuns(piece, open);
      if (!runs.length) continue;
      if (!verse) throw new Error(`Text outside a verse in ${book}: ${piece.slice(0, 60)}`);
      if (fresh) {
        verse.blocks.push({ style, runs: [] });
        fresh = false;
      }
      const block = /** @type {Block} */ (verse.blocks.at(-1));
      for (const run of runs) {
        const previous = block.runs.at(-1);
        if (previous && previous.marks.join(' ') === run.marks.join(' ')) previous.text += run.text;
        else block.runs.push(run);
      }
    }
  }
}

/**
 * A block is a line of its own, so the space at its two ends is the source's
 * and not the text's. Neither is a doubled space between two runs.
 *
 * @param {Block} block
 */
function trim(block) {
  // A space can end one run and start the next, where the source spaced a
  // marker twice (\\wj  \\+w). The text has one.
  for (let i = 1; i < block.runs.length; i += 1) {
    if (/\s$/.test(block.runs[i - 1].text)) block.runs[i].text = block.runs[i].text.trimStart();
  }
  const first = block.runs[0];
  if (first) first.text = first.text.trimStart();
  const last = block.runs.at(-1);
  if (last) last.text = last.text.trimEnd();
  block.runs = block.runs.filter((run) => run.text !== '');
}

/**
 * The words of the blocks, with no markup. A stanza break adds nothing.
 *
 * @param {Block[]} blocks
 */
export function plainText(blocks) {
  return blocks
    .map((block) => block.runs.map((run) => run.text).join(''))
    .filter(Boolean)
    .join(' ');
}
