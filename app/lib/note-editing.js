// Writing in a note where it lies on the table (ProseMirror). The note's
// words on its card are the editor: a tap puts the caret where it touched.
//
//   show(host, doc)          the words, not editable
//   edit(host, doc, hooks)   the words, editable, with the caret at a point;
//                            returns { view, end }
//
// While a note is written:
//   - its changes go to hooks.change(doc) as they come;
//   - Escape, or hooks' owner calling end(), ends it; hooks.done(doc) hears;
//   - Mod-Z and Shift-Mod-Z undo and redo within the note (the table's own
//     undo takes the whole edit as one step, after it ends);
//   - Mod-B and Mod-I make bold and italic; "# " and "## " at the start of a
//     line make a heading, "- " a list, "1. " a numbered list; Tab and
//     Shift-Tab move a list item in and out;
//   - the app's on-screen keyboard (touch-keys) types by `keys-type` events
//     on the editor ({ key }: a letter, space, enter, back);
//   - a reference typed ("John 3:16") or @ and a name ("@Abraham") offers to
//     become a reference button (lib/note-suggest.js);
//   - words selected show a bar to format them (lib/note-format.js).

import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { DOMSerializer } from 'prosemirror-model';
import { baseKeymap, toggleMark, deleteSelection, joinBackward, selectNodeBackward, chainCommands, splitBlock } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { inputRules, wrappingInputRule, textblockTypeInputRule, smartQuotes, ellipsis, emDash } from 'prosemirror-inputrules';
import { splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { plainRefs, schema } from './note-doc.js';
import { suggestions } from './note-suggest.js';
import { formatBar } from './note-format.js';

/** @typedef {Map<string, HTMLElement>} Quotes each quote's words as the card's server drew them, by span address */

/**
 * The words of a note, not editable, with each quote's words in its place.
 *
 * @param {HTMLElement} host
 * @param {import('prosemirror-model').Node} doc
 * @param {Quotes} [quotes]
 */
export function show(host, doc, quotes = new Map()) {
  host.replaceChildren(DOMSerializer.fromSchema(schema).serializeFragment(doc.content));
  for (const holder of host.querySelectorAll('section[data-quote]')) {
    const drawn = quotes.get(/** @type {HTMLElement} */ (holder).dataset.quote ?? '');
    if (drawn) holder.replaceWith(drawn);
  }
  host.classList.toggle('is-empty', doc.childCount === 1 && doc.firstChild?.content.size === 0);
}

const rules = inputRules({
  rules: [
    ...smartQuotes,
    ellipsis,
    emDash,
    textblockTypeInputRule(/^(#{1,2})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })),
    wrappingInputRule(/^\s*[-*•]\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) }), (match, node) => node.childCount + node.attrs.order === Number(match[1])),
  ],
});

const backspace = chainCommands(deleteSelection, joinBackward, selectNodeBackward);
const enter = chainCommands(splitListItem(schema.nodes.list_item), baseKeymap.Enter);

/**
 * A key of the app's own keyboard, as the editor's command.
 *
 * @param {EditorView} view
 * @param {string} key
 */
function typeKey(view, key) {
  const { state, dispatch } = view;
  if (key === 'back') backspace(state, dispatch);
  else if (key === 'enter') enter(state, dispatch) || splitBlock(state, dispatch);
  else if (key === 'clear') dispatch(state.tr.delete(0, state.doc.content.size).setSelection(TextSelection.create(state.tr.doc, 1)));
  else {
    const text = key === 'space' ? ' ' : key;
    // Through the input rules, as typing goes: "- " starts a list.
    const { from, to } = state.selection;
    const handled = view.someProp('handleTextInput', (handle) => handle(view, from, to, text));
    if (!handled) dispatch(state.tr.insertText(text, from, to));
  }
}

/**
 * Makes a note's words editable where they lie.
 *
 * @param {HTMLElement} host the element that shows the words
 * @param {import('prosemirror-model').Node} doc
 * @param {{ at?: { x: number, y: number } | null, quotes?: Quotes, load?: (span: string) => Promise<HTMLElement | null>, change: (doc: import('prosemirror-model').Node) => void, done: (doc: import('prosemirror-model').Node) => void }} hooks
 *   `quotes`: each quote's words, drawn; `load` draws one not yet drawn (a
 *   reference just opened into a quote)
 */
export function edit(host, doc, hooks) {
  host.replaceChildren();
  host.classList.remove('is-empty');
  let ended = false;
  const quotes = hooks.quotes ?? new Map();
  // A quote last: a line after it, to go on writing.
  const start = doc.lastChild?.type === schema.nodes.quote ? doc.copy(doc.content.addToEnd(schema.nodes.paragraph.create())) : doc;
  const view = new EditorView(host, {
    // A quote is the passage's words as the server drew them: not editable,
    // and its buttons (fold, remove) are the table's.
    nodeViews: {
      quote: (node) => {
        const span = node.attrs.span;
        let dom = quotes.get(span);
        if (!dom) {
          dom = document.createElement('section');
          dom.className = 'note__quote is-loading';
          dom.dataset.quote = span;
          dom.append(Object.assign(document.createElement('p'), { className: 'note__source', textContent: node.attrs.title }), Object.assign(document.createElement('div'), { className: 'note__words' }));
          const holder = dom;
          hooks.load?.(span).then((drawn) => {
            if (!drawn || view.isDestroyed) return;
            quotes.set(span, drawn);
            holder.replaceChildren(...drawn.childNodes);
            holder.classList.remove('is-loading');
            quotes.set(span, holder);
            Object.assign(holder.dataset, { title: drawn.dataset.title ?? '' });
          });
        }
        dom.contentEditable = 'false';
        return {
          dom,
          stopEvent: (event) => event.target instanceof Element && Boolean(event.target.closest('button')),
          ignoreMutation: () => true,
          destroy: () => dom?.removeAttribute('contenteditable'),
        };
      },
    },
    state: EditorState.create({
      doc: start,
      plugins: [
        // First, so that its keys (Up, Down, Tab, Enter, Escape) come first
        // while its list shows.
        suggestions(),
        formatBar(),
        history(),
        rules,
        keymap({
          'Mod-z': undo,
          'Shift-Mod-z': redo,
          'Mod-y': redo,
          'Mod-b': (state, dispatch) => toggleMark(schema.marks.strong)(state, dispatch && ((tr) => dispatch(plainRefs(tr)))),
          'Mod-i': (state, dispatch) => toggleMark(schema.marks.em)(state, dispatch && ((tr) => dispatch(plainRefs(tr)))),
          Enter: enter,
          Tab: sinkListItem(schema.nodes.list_item),
          'Shift-Tab': liftListItem(schema.nodes.list_item),
          Escape: () => {
            end();
            return true;
          },
        }),
        keymap(baseKeymap),
      ],
    }),
    attributes: { class: 'note__editor', 'aria-label': 'Text of the note', spellcheck: 'true' },
    dispatchTransaction(transaction) {
      view.updateState(view.state.apply(transaction));
      if (transaction.docChanged) hooks.change(view.state.doc);
    },
  });
  // The caret where the finger or the mouse touched, else at the end.
  const point = hooks.at ? view.posAtCoords({ left: hooks.at.x, top: hooks.at.y }) : null;
  const selection = point ? TextSelection.near(view.state.doc.resolve(point.pos)) : TextSelection.atEnd(view.state.doc);
  view.dispatch(view.state.tr.setSelection(selection));
  view.focus();

  /** @param {Event} event */
  const typed = (event) => typeKey(view, /** @type {CustomEvent} */ (event).detail.key);
  view.dom.addEventListener('keys-type', typed);

  function end() {
    if (ended) return;
    ended = true;
    const last = view.state.doc;
    view.dom.removeEventListener('keys-type', typed);
    view.destroy();
    show(host, last, quotes);
    hooks.done(last);
  }
  return { view, end };
}
