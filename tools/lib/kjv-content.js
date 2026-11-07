// Reads the `content` HTML of one verse from the API.Bible export and returns
// it as blocks of runs.
//
// The export writes each verse as one or more <p> blocks. A block's class is its
// USFM paragraph style, and a <span> inside it is a character style. The verse
// number arrives as a <span class="v"> and is dropped, because the verse record
// carries its number already.
//
// Anything this file does not recognize throws. A new tag or class in the source
// is a decision to make, not text to pass through.

/** Paragraph styles. `p` prose, `q1` poetry, `d` a psalm title, `b` a stanza break, `s1` a heading. */
export const BLOCK_STYLES = new Set(['p', 'q1', 'd', 'b', 's1']);

/**
 * Character styles. `add` words the translators supplied (printed in italics),
 * `nd` the divine name (LORD), `wj` the words of Jesus, `tl` a transliterated
 * letter heading in Psalm 119.
 */
export const MARKS = new Set(['add', 'nd', 'wj', 'tl']);

/**
 * @typedef {{ text: string, marks: string[] }} Run
 * @typedef {{ style: string, numbered?: true, runs: Run[] }} Block
 *
 * `numbered` marks the block the verse number sits in. A psalm title comes
 * before the number, so the number is not always in the first block.
 */

const TOKEN = /<(\/?)([a-z0-9]+)((?:\s+[a-z-]+="[^"]*")*)\s*>|([^<]+)/y;
const ATTRIBUTE = /([a-z-]+)="([^"]*)"/g;

/**
 * @param {string} html the verse's `content`
 * @param {string} number the verse number, which the `v` span must repeat
 * @returns {Block[]}
 */
export function parseContent(html, number) {
  /** @type {Block[]} */
  const blocks = [];
  /** @type {Block | null} */
  let block = null;
  /** @type {string[]} the classes of the open spans, outermost first */
  const spans = [];
  let sawNumber = false;

  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < html.length) {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(html);
    if (!match) throw new Error(`Unreadable markup at ${at}: ${html.slice(at, at + 40)}`);

    const [, closing, tag, attributeText, text] = match;

    if (text !== undefined) {
      if (text.includes('&')) throw new Error(`An entity in verse ${number}: ${text}`);
      if (spans.at(-1) === 'v') {
        if (text.trim() !== number) throw new Error(`Verse ${number} is numbered ${text}`);
        continue;
      }
      if (!block) {
        if (text.trim()) throw new Error(`Text outside a block in verse ${number}: ${text}`);
        continue;
      }
      addRun(block, text, spans.filter((name) => name !== 'v'));
      continue;
    }

    const attributes = readAttributes(attributeText);

    if (tag === 'p' && !closing) {
      if (block) throw new Error(`A block inside a block in verse ${number}`);
      const style = attributes.class ?? '';
      if (!BLOCK_STYLES.has(style)) throw new Error(`Unknown block style "${style}" in verse ${number}`);
      block = { style, runs: [] };
      blocks.push(block);
      continue;
    }

    if (tag === 'p' && closing) {
      if (!block) throw new Error(`A closing </p> with no block in verse ${number}`);
      if (spans.length) throw new Error(`A span left open at the end of a block in verse ${number}`);
      block = null;
      continue;
    }

    if (tag === 'span' && !closing) {
      const name = attributes.class ?? '';
      if (name === 'v') {
        if (attributes['data-number'] !== number) {
          throw new Error(`Verse ${number} carries data-number ${attributes['data-number']}`);
        }
        if (!block) throw new Error(`Verse ${number} is numbered outside a block`);
        block.numbered = true;
        sawNumber = true;
      } else if (!MARKS.has(name)) {
        throw new Error(`Unknown character style "${name}" in verse ${number}`);
      }
      spans.push(name);
      continue;
    }

    if (tag === 'span' && closing) {
      if (!spans.length) throw new Error(`A closing </span> with nothing open in verse ${number}`);
      spans.pop();
      continue;
    }

    throw new Error(`Unknown tag <${closing}${tag}> in verse ${number}`);
  }

  if (block) throw new Error(`Verse ${number} ends inside a block`);
  if (!sawNumber) throw new Error(`Verse ${number} has no verse number`);

  for (const each of blocks) trimBlock(each);
  return blocks;
}

/**
 * The words of the blocks, with no markup. A blank-line block adds nothing.
 *
 * @param {Block[]} blocks
 */
export function plainText(blocks) {
  return blocks
    .map((block) => block.runs.map((run) => run.text).join(''))
    .filter(Boolean)
    .join(' ');
}

/** @param {string} text */
function readAttributes(text) {
  /** @type {Record<string, string>} */
  const attributes = {};
  for (const [, name, value] of text.matchAll(ATTRIBUTE)) attributes[name] = value;
  return attributes;
}

/**
 * Joins the text to the last run when the marks are the same, so a block holds
 * as few runs as its styling needs.
 *
 * @param {Block} block
 * @param {string} text
 * @param {string[]} marks
 */
function addRun(block, text, marks) {
  const last = block.runs.at(-1);
  if (last && sameMarks(last.marks, marks)) {
    last.text += text;
    return;
  }
  block.runs.push({ text, marks: [...marks] });
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function sameMarks(a, b) {
  return a.length === b.length && a.every((mark, i) => mark === b[i]);
}

/**
 * A block is a line of its own, so the space at its two ends is the export's
 * and not the text's.
 *
 * @param {Block} block
 */
function trimBlock(block) {
  const first = block.runs[0];
  if (first) first.text = first.text.trimStart();
  const last = block.runs.at(-1);
  if (last) last.text = last.text.trimEnd();
  block.runs = block.runs.filter((run) => run.text !== '');
}
