// A note's words as a document (ProseMirror's model): paragraphs, headings,
// lists, bold, italic, a highlight in the app's pigments, and references to
// passages, people, places and words. The table keeps
// each note's document as JSON (note.doc) beside its plain text (note.text),
// which search reads. A note from before documents has only its text, and
// becomes a document of one paragraph a line (fromText).
//
// The editing itself is lib/note-editing.js; this file is only the model, so
// that it can be read and tested without a page.

import { Schema, Node } from 'prosemirror-model';
import { addListNodes } from 'prosemirror-schema-list';

/** The highlight's pigments, as the app names them (global.css). */
export const PIGMENTS = /** @type {const} */ (['ochre', 'lapis', 'verdigris']);

const base = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h3', attrs: { level: 1 } },
        { tag: 'h4', attrs: { level: 2 } },
      ],
      toDOM: (node) => [node.attrs.level === 1 ? 'h3' : 'h4', { class: 'note__heading' }, 0],
    },
    text: { group: 'inline' },
    // A reference: a passage (JHN.3.16), a person, place, group or event
    // (person:abraham_58), or a word of the original (H430). A tap on it,
    // when the note is not being written, puts it on the table, or studies
    // the word in the search panel (bible-table clicked).
    ref: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { address: {}, label: {}, kind: { default: 'passage' } },
      parseDOM: [{
        tag: 'button.note__ref',
        getAttrs: (dom) => {
          const element = /** @type {HTMLElement} */ (dom);
          return { address: element.dataset.cite ?? element.dataset.study ?? '', label: element.textContent ?? '', kind: element.dataset.kind ?? 'passage' };
        },
      }],
      toDOM: (node) => [
        'button',
        {
          type: 'button',
          tabindex: '-1',
          class: `note__ref note__ref--${node.attrs.kind}`,
          'data-kind': node.attrs.kind,
          ...(node.attrs.kind === 'word' ? { 'data-study': node.attrs.address } : { 'data-cite': node.attrs.address }),
        },
        node.attrs.label,
      ],
      leafText: (node) => node.attrs.label,
    },
    // A quote: words of a passage, by their span address
    // (JHN.3.16.w1-JHN.3.16.w25), shown as the text itself. The card's
    // server renders each quote's words; the table puts them in place
    // (lib/note-editing.js). Its title is the passage's, for a reference.
    quote: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { span: {}, title: { default: '' } },
      parseDOM: [{
        tag: 'section.note__quote',
        getAttrs: (dom) => ({ span: /** @type {HTMLElement} */ (dom).dataset.quote ?? '', title: /** @type {HTMLElement} */ (dom).dataset.title ?? '' }),
      }],
      toDOM: (node) => ['section', { class: 'note__quote', 'data-quote': node.attrs.span, 'data-title': node.attrs.title }],
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
  },
  marks: {
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM: () => ['strong', 0],
    },
    em: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM: () => ['em', 0],
    },
    highlight: {
      attrs: { pigment: { default: 'ochre' } },
      parseDOM: [{ tag: 'mark', getAttrs: (dom) => ({ pigment: /** @type {HTMLElement} */ (dom).dataset.pigment ?? 'ochre' }) }],
      toDOM: (mark) => ['mark', { class: `note__mark note__mark--${mark.attrs.pigment}`, 'data-pigment': mark.attrs.pigment }, 0],
    },
  },
});

export const schema = new Schema({
  nodes: addListNodes(base.spec.nodes, 'paragraph block*', 'block'),
  marks: base.spec.marks,
});

/**
 * A text with headings as a document: a line that begins "# " is a heading,
 * "## " a smaller one, and any other line a paragraph. An assistant writes
 * its notes so (tools/mcp-server.js table_note).
 *
 * @param {string} text
 * @returns {any} the document as JSON
 */
export function fromOutline(text) {
  /** @param {string} words */
  const inline = (words) => (words ? [{ type: 'text', text: words }] : []);
  const content = text.split('\n').map((line) => {
    const heading = /^(#{1,2}) +(.*)$/.exec(line);
    if (heading) return { type: 'heading', attrs: { level: heading[1].length }, content: inline(heading[2].trim()) };
    return { type: 'paragraph', content: inline(line) };
  });
  return { type: 'doc', content };
}

/**
 * A plain text as a document: a paragraph a line.
 *
 * @param {string} text
 * @returns {any} the document as JSON
 */
export function fromText(text) {
  const lines = text.split('\n');
  return {
    type: 'doc',
    content: lines.map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' })),
  };
}

/**
 * A document's JSON with its quotes made to match a note's: a quote the note
 * no longer has goes, one it has twice shows once, and one the document
 * lacks (a note from before quotes were placed) goes at the end.
 *
 * @param {any} json
 * @param {string[] | undefined} spans the note's quotes, as span addresses
 */
function withQuotes(json, spans) {
  const seen = new Set();
  // With no list of quotes, the document's own are kept as they are.
  const keepAll = !spans;
  /** @param {any} node @returns {any} */
  const keep = (node) => {
    // A reference marked before references took no marks: the marks go.
    if (node.type === 'ref' && node.marks) {
      const { marks, ...rest } = node;
      return rest;
    }
    if (node.type === 'quote') {
      const span = node.attrs?.span;
      if (keepAll) return node;
      if (!spans.includes(span) || seen.has(span)) return null;
      seen.add(span);
      return node;
    }
    if (!Array.isArray(node.content)) return node;
    const content = node.content.map(keep).filter(Boolean);
    // A list item must start with a paragraph; a doc must hold a block.
    if (node.type === 'list_item' && content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
    return { ...node, content };
  };
  const doc = keep(json);
  for (const span of spans ?? []) if (!seen.has(span)) doc.content.push({ type: 'quote', attrs: { span, title: '' } });
  if (!doc.content.length) doc.content.push({ type: 'paragraph' });
  return doc;
}

/**
 * A note's document, from its JSON, or from its text where it has none or
 * the JSON is not one; with the note's quotes, where it has a list of them.
 *
 * @param {{ doc?: any, text?: string, quotes?: { from: string, to: string }[] }} note
 * @returns {Node}
 */
export function docOf(note) {
  const spans = note.quotes?.map((each) => `${each.from}-${each.to}`);
  /** @param {any} json */
  const read = (json) => {
    const doc = Node.fromJSON(schema, withQuotes(json, spans));
    doc.check();
    return doc;
  };
  const doc = note.doc && typeof note.doc === 'object' ? readable(read, note.doc) : null;
  return doc ?? read(fromText(note.text ?? ''));
}

/**
 * A stored document read in this schema: as it is, or without the marks
 * this schema does not know (one from a later or an earlier version);
 * null if it still does not fit, and the note reads from its text. That is
 * said in the console, as the note's formatting is then not kept.
 *
 * @param {(json: any) => Node} read
 * @param {any} json
 */
function readable(read, json) {
  for (const each of [json, knownMarks(json)]) {
    try {
      return read(each);
    } catch {
      // Not a document of this schema yet.
    }
  }
  console.warn('A note does not fit the notes\' schema: it reads from its plain text, without its formatting.');
  return null;
}

/**
 * A document's JSON with only the marks this schema knows.
 *
 * @param {any} node
 * @returns {any}
 */
function knownMarks(node) {
  if (!node || typeof node !== 'object') return node;
  const marks = Array.isArray(node.marks) ? node.marks.filter((/** @type {any} */ mark) => Object.hasOwn(schema.marks, mark?.type)) : undefined;
  const content = Array.isArray(node.content) ? node.content.map(knownMarks) : undefined;
  return { ...node, ...(marks ? { marks } : {}), ...(content ? { content } : {}) };
}

/**
 * The quotes of a document, as span addresses, in their order.
 *
 * @param {Node} doc
 */
export function quotesIn(doc) {
  /** @type {string[]} */
  const spans = [];
  doc.descendants((node) => {
    if (node.type.name === 'quote') spans.push(node.attrs.span);
    return !node.isTextblock;
  });
  return spans;
}

const PASSAGE = /^([1-3A-Z]{3})\.(\d{1,3})\.(\d{1,3})(?:-(?:(\d{1,3})\.)?(\d{1,3}))?$/;
// A span of words, of the KJV (w) or the BSB (b).
const WORDS = /^([1-3A-Z]{3})\.(\d{1,3})\.(\d{1,3})\.[wb]\d+-[1-3A-Z]{3}\.(\d{1,3})\.(\d{1,3})\.[wb]\d+$/;

/**
 * The span of a reference to verses, whole verses (JHN.3.16-18 to
 * JHN.3.16.w1-JHN.3.18.w999: the last word number only bounds), or null for a
 * chapter or anything else.
 *
 * @param {string} address
 */
export function spanOfRef(address) {
  const match = PASSAGE.exec(address);
  if (!match) return null;
  const [, book, chapter, verse, toChapter, toVerse] = match;
  return `${book}.${chapter}.${verse}.w1-${book}.${toChapter ?? chapter}.${toVerse ?? verse}.w999`;
}

/**
 * The verses a span is in, as a reference: JHN.3.16, JHN.3.16-18, or
 * JHN.3.36-4.2.
 *
 * @param {string} span
 */
export function refOfSpan(span) {
  const match = WORDS.exec(span);
  if (!match) return null;
  const [, book, chapter, verse, toChapter, toVerse] = match;
  if (chapter === toChapter && verse === toVerse) return `${book}.${chapter}.${verse}`;
  if (chapter === toChapter) return `${book}.${chapter}.${verse}-${toVerse}`;
  return `${book}.${chapter}.${verse}-${toChapter}.${toVerse}`;
}

/**
 * A document's plain text: a line a block, for search and for a note's
 * summary.
 *
 * @param {Node} doc
 */
export function toText(doc) {
  /** @type {string[]} */
  const lines = [];
  doc.descendants((node) => {
    if (!node.isTextblock) return true;
    lines.push(node.textBetween(0, node.content.size, '', (leaf) => (leaf.type.name === 'ref' ? leaf.attrs.label : leaf.type.name === 'hard_break' ? '\n' : '')));
    return false;
  });
  return lines.join('\n').replace(/\n+$/, '');
}

/**
 * Takes any bold, italic or highlight off the references in a change: a
 * reference keeps its own look.
 *
 * @param {import('prosemirror-state').Transaction} tr
 * @returns {import('prosemirror-state').Transaction}
 */
export function plainRefs(tr) {
  tr.doc.descendants((node, pos) => {
    if (node.type.name === 'ref' && node.marks.length) tr.setNodeMarkup(pos, null, node.attrs, []);
    return node.isBlock;
  });
  return tr;
}
