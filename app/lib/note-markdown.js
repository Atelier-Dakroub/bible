// A note as Markdown, to copy or to save (bible-table): its words with
// their headings, lists, bold, italic and highlights (==words==), each
// reference as a link to the app, and each quote as a block quote with its
// reference and version.

/** @typedef {import('prosemirror-model').Node} Node */
/**
 * @typedef {{
 *   origin: string,
 *   quote: (span: string) => { text: string, title: string } | null,
 *   heading?: number
 * }} Options `origin` the app's address, for links; `quote` a quote's words;
 *   `heading` the level of the note's own headings (2 by default, for ##)
 */

/** Text with Markdown's own marks escaped. */
const plain = (/** @type {string} */ text) => text.replace(/([\\`*_[\]<>]|==)/g, (match) => `\\${match}`);

/**
 * A part of a link, encoded so that it cannot end the Markdown link early:
 * encodeURIComponent leaves ( ) ' ! * as they are.
 *
 * @param {string} text
 */
const linkSafe = (text) => encodeURIComponent(text).replace(/[()'!*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * A link to what a reference names, in the app.
 *
 * @param {{ address: string, kind: string }} ref
 * @param {string} origin
 */
export function linkOf(ref, origin) {
  if (ref.kind === 'word') return `${origin}/search?q=${linkSafe(ref.address)}`;
  return `${origin}/card/${linkSafe(ref.address).replace(/%3A/g, ':')}`;
}

/**
 * @param {Node} block a text block
 * @param {Options} options
 */
function inline(block, options) {
  let out = '';
  block.forEach((node) => {
    if (node.type.name === 'ref') {
      out += `[${plain(node.attrs.label)}](${linkOf(node.attrs, options.origin)})`;
      return;
    }
    if (node.type.name === 'hard_break') {
      out += '  \n';
      return;
    }
    let text = plain(node.text ?? '');
    // Marks wrap the words, not the spaces at their ends.
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) ?? ['', '', text, ''];
    text = core;
    for (const mark of node.marks) {
      if (!text) break;
      if (mark.type.name === 'strong') text = `**${text}**`;
      else if (mark.type.name === 'em') text = `*${text}*`;
      else if (mark.type.name === 'highlight') text = `==${text}==`;
    }
    out += lead + text + trail;
  });
  return out;
}

/**
 * @param {Node} node a block
 * @param {Options} options
 * @param {string} indent
 * @returns {string[]} its lines
 */
function block(node, options, indent) {
  const name = node.type.name;
  if (name === 'paragraph') return [indent + inline(node, options)];
  if (name === 'heading') return [`${indent}${'#'.repeat(Math.min(6, (options.heading ?? 2) + node.attrs.level - 1))} ${inline(node, options)}`];
  if (name === 'quote') {
    const quote = options.quote(node.attrs.span);
    const title = quote?.title || node.attrs.title;
    return [`${indent}> ${quote?.text ?? ''}`, `${indent}> — ${title} (KJV)`];
  }
  if (name === 'bullet_list' || name === 'ordered_list') {
    /** @type {string[]} */
    const lines = [];
    let number = node.attrs.order ?? 1;
    node.forEach((item) => {
      const marker = name === 'bullet_list' ? '- ' : `${number}. `;
      number += 1;
      const inner = blocks(item, options, `${indent}${' '.repeat(marker.length)}`);
      // The first line takes the marker in place of its indent.
      if (inner.length) inner[0] = `${indent}${marker}${inner[0].slice(indent.length + marker.length)}`;
      lines.push(...inner.filter((line, at) => at === 0 || line.trim()));
    });
    return lines;
  }
  return [];
}

/**
 * @param {Node} parent
 * @param {Options} options
 * @param {string} indent
 */
function blocks(parent, options, indent) {
  /** @type {string[]} */
  const lines = [];
  parent.forEach((child, _, index) => {
    const inList = parent.type.name === 'list_item';
    if (index > 0 && !inList) lines.push('');
    lines.push(...block(child, options, indent));
  });
  return lines;
}

/**
 * A note's document as Markdown.
 *
 * @param {Node} doc
 * @param {Options} options
 */
export function toMarkdown(doc, options) {
  return blocks(doc, options, '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
