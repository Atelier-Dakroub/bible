// Markdown to HTML, for the guide's pages (app/routes/guide/*.md). Transclude
// serves a .md file under app/routes as a page, through the converter that
// transclude.config.js gives it; it ships no parser of its own.
//
// The guide needs a small part of Markdown, and this is that part:
//   # headings (each with an id, for a link to it), paragraphs,
//   - lists and 1. numbered lists (and a list in a list, indented),
//   > notes, | tables |, **bold**, *italic*, `code`, [links](/somewhere),
//   and <kbd>keys</kbd>.
// Every other character is text: the converter escapes it, so a page cannot
// carry a script, and ${…} cannot reach Transclude's templates.

/** @param {string} text it, safe in HTML and in a Transclude template */
export function escape(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\$\{/g, '&#36;{');
}

/** @param {string} text a heading's id: its words in small letters, joined by hyphens */
export function slug(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]*>|[`*]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

/**
 * A link's address, if it is safe: on this site, or on the web. Any other
 * (javascript:, data:) is no link.
 *
 * @param {string} url
 */
const safeUrl = (url) => (/^(\/|#|https?:\/\/|mailto:)/.test(url) ? url : '');

/** @type {[RegExp, (...parts: string[]) => string][]} the inline marks, in order */
const INLINE = [
  [/&lt;kbd&gt;(.+?)&lt;\/kbd&gt;/g, (_, key) => `<kbd>${key}</kbd>`],
  [/\*\*(.+?)\*\*/g, (_, text) => `<strong>${text}</strong>`],
  [/\*(.+?)\*/g, (_, text) => `<em>${text}</em>`],
  [/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, text, url) => (safeUrl(url) ? `<a href="${url}">${text}</a>` : text)],
];

/**
 * A line's text with its inline marks. Code is kept as it is, with no marks
 * in it.
 *
 * @param {string} text
 */
export function inline(text) {
  return escape(text)
    .split(/(`[^`]+`)/)
    .map((part) => (part.startsWith('`') && part.endsWith('`') && part.length > 1 ? `<code>${part.slice(1, -1)}</code>` : INLINE.reduce((html, [pattern, mark]) => html.replace(pattern, mark), part)))
    .join('');
}

/** @typedef {{ kind: string, lines: string[] }} Block */

/** @type {[string, RegExp][]} each kind of block, by its first line */
const STARTS = [
  ['heading', /^#{1,4} /],
  ['list', /^\s*[-*] /],
  ['numbered', /^\s*\d+\. /],
  ['note', /^> ?/],
  ['table', /^\|/],
];

/** @param {string} line the kind of block it starts */
const kindOf = (line) => STARTS.find(([, pattern]) => pattern.test(line))?.[0] ?? 'paragraph';

/**
 * The blocks of a page: runs of lines of one kind, apart from blank lines. A
 * heading is a block of its own line.
 *
 * @param {string} source
 * @returns {Block[]}
 */
export function blocksOf(source) {
  /** @type {Block[]} */
  const blocks = [];
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const last = blocks.at(-1);
    if (!line.trim()) blocks.push({ kind: 'blank', lines: [] });
    else if (continues(last, line)) last?.lines.push(line);
    else blocks.push({ kind: kindOf(line), lines: [line] });
  }
  return blocks.filter((block) => block.kind !== 'blank');
}

/**
 * Whether a line goes on in the block before it: a paragraph's next line, an
 * item's next line or a list in it, or the next row or line of its kind.
 *
 * @param {Block | undefined} block
 * @param {string} line
 */
function continues(block, line) {
  if (!block || block.kind === 'blank' || block.kind === 'heading') return false;
  const kind = kindOf(line);
  if (block.kind === 'list' || block.kind === 'numbered') return kind === block.kind || /^\s+/.test(line) || kind === 'paragraph';
  return kind === block.kind;
}

/**
 * A list, with the lists indented in its items.
 *
 * @param {string[]} lines
 * @param {boolean} numbered
 */
function list(lines, numbered) {
  const tag = numbered ? 'ol' : 'ul';
  const marker = numbered ? /^\d+\. / : /^[-*] /;
  /** @type {{ text: string, inner: string[] }[]} */
  const items = [];
  for (const line of lines) {
    const item = items.at(-1);
    if (marker.test(line)) items.push({ text: line.replace(marker, ''), inner: [] });
    else if (item && nested(line, item.inner)) item.inner.push(line.replace(/^ {2,4}/, ''));
    else if (item) item.text += ` ${line.trim()}`;
  }
  return `<${tag}>${items.map((item) => `<li>${inline(item.text)}${item.inner.length ? render(item.inner.join('\n')) : ''}</li>`).join('')}</${tag}>`;
}

/**
 * Whether an item's line is in a list of its own: an indented item, or a
 * line after one. Another line goes on with the item's text.
 *
 * @param {string} line
 * @param {string[]} inner the item's lines in a list so far
 */
const nested = (line, inner) => /^\s+([-*]|\d+\.) /.test(line) || (inner.length > 0 && /^\s+/.test(line));

/** @param {string} row a table row's cells */
const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

/**
 * A table: a row of headings, a row of dashes, then the rows.
 *
 * @param {string[]} lines
 */
function table(lines) {
  const [head, , ...rows] = lines;
  const th = cells(head).map((cell) => `<th scope="col">${inline(cell)}</th>`).join('');
  const body = rows.map((row) => `<tr>${cells(row).map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * A heading, with an id for a link to it.
 *
 * @param {string} line
 */
function heading(line) {
  const level = /^#+/.exec(line)?.[0].length ?? 1;
  const text = line.replace(/^#+\s*/, '');
  return `<h${level} id="${slug(text)}">${inline(text)}</h${level}>`;
}

/** @type {Record<string, (lines: string[]) => string>} how each kind of block is written */
const WRITERS = {
  heading: ([line]) => heading(line),
  list: (lines) => list(lines, false),
  numbered: (lines) => list(lines, true),
  note: (lines) => `<aside class="guide__note">${render(lines.map((line) => line.replace(/^> ?/, '')).join('\n'))}</aside>`,
  table,
  paragraph: (lines) => `<p>${inline(lines.map((line) => line.trim()).join(' '))}</p>`,
};

/**
 * Markdown to HTML.
 *
 * @param {string} source
 */
export function render(source) {
  return blocksOf(source)
    .map((block) => WRITERS[block.kind](block.lines))
    .join('\n');
}

/**
 * A guide page: its title from its first heading, its text, and the way
 * back to the guide and to the table.
 *
 * @param {string} source
 */
export function guidePage(source) {
  const title = /^# (.+)$/m.exec(source)?.[1] ?? 'Guide';
  const nav = '<nav class="guide__nav" aria-label="Guide"><a href="/guide">The guide</a> <a href="/table">Back to the table</a></nav>';
  return `<title>${escape(title.replace(/[`*]/g, ''))}</title>\n<main class="page guide">\n${nav}\n${render(source)}\n</main>\n`;
}
