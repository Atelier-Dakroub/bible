// Quotes in a note, and references to verses: one opens into the other
// (ProseMirror commands, for lib/note-format.js and the table).

import { EditorState, NodeSelection } from 'prosemirror-state';
import { refOfSpan, schema, spanOfRef } from './note-doc.js';

/** @typedef {import('prosemirror-state').EditorState} EditorState */
/** @typedef {import('prosemirror-view').EditorView} EditorView */

/**
 * The reference the selection is: a reference chosen whole, or selected as
 * the only thing in a run of text (Shift and an arrow).
 *
 * @param {EditorState} state
 * @returns {{ node: import('prosemirror-model').Node, from: number, to: number } | null}
 */
export function selectedRef(state) {
  const { selection } = state;
  const node = selection instanceof NodeSelection ? selection.node : selection.to - selection.from === 1 ? state.doc.nodeAt(selection.from) : null;
  return node?.type === schema.nodes.ref ? { node, from: selection.from, to: selection.to } : null;
}

/**
 * Opens a reference to verses into a quote of them: the quote goes after
 * the reference's line (in its place, if the line held only it).
 *
 * @param {EditorState} state
 * @param {EditorView['dispatch']} [dispatch]
 */
export function openRef(state, dispatch) {
  const selection = selectedRef(state);
  if (!selection) return false;
  const span = spanOfRef(selection.node.attrs.address);
  if (!span) return false;
  if (!dispatch) return true;
  const quote = schema.nodes.quote.create({ span, title: selection.node.attrs.label });
  const $at = state.doc.resolve(selection.from);
  const line = $at.parent;
  const tr = state.tr;
  if (line.childCount === 1) {
    tr.replaceWith($at.before(), $at.after(), quote);
  } else {
    tr.delete(selection.from, selection.to);
    tr.insert(tr.mapping.map($at.after()), quote);
  }
  dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Closes a quote into a reference to its verses, on a line of its own.
 *
 * @param {EditorState} state
 * @param {number} at where the quote is
 * @param {EditorView['dispatch']} [dispatch]
 */
export function foldQuote(state, at, dispatch) {
  const node = state.doc.nodeAt(at);
  if (node?.type !== schema.nodes.quote) return false;
  const address = refOfSpan(node.attrs.span);
  if (!address) return false;
  const ref = schema.nodes.ref.create({ address, label: node.attrs.title || address, kind: 'passage' });
  dispatch?.(state.tr.replaceWith(at, at + node.nodeSize, schema.nodes.paragraph.create(null, ref)));
  return true;
}

/**
 * Where a quote of a span is in a document, or -1.
 *
 * @param {import('prosemirror-model').Node} doc
 * @param {string} span
 */
export function quoteAt(doc, span) {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type === schema.nodes.quote && node.attrs.span === span) found = pos;
    return !node.isTextblock;
  });
  return found;
}

/**
 * A document with a quote closed into a reference, or null if it has none
 * of that span.
 *
 * @param {import('prosemirror-model').Node} doc
 * @param {string} span
 * @returns {import('prosemirror-model').Node | null}
 */
export function foldedIn(doc, span) {
  const state = EditorState.create({ doc });
  /** @type {import('prosemirror-model').Node | null} */
  let next = null;
  foldQuote(state, quoteAt(doc, span), (tr) => {
    next = state.apply(tr).doc;
  });
  return /** @type {import('prosemirror-model').Node | null} */ (next);
}
