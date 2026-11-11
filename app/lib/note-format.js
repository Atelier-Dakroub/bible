// The formatting bar of a note being written (a ProseMirror plugin, for
// lib/note-editing.js): over the words a finger or the mouse selects, so the
// formatting is as direct as the rest of the table. Bold, italic, heading,
// list, numbered list, and a highlight in ochre, lapis or verdigris (and,
// for a reference to verses, Quote, which opens it into their words); a
// pressed button shows what the words already have, and a press again takes
// it off. With a finger, the bar sits under the words, clear of the phone's
// own menu over them. The keys do the same: Mod-B, Mod-I, "# ", "- ", "1. ".
// The bar is outside the card, so the table counts a press on it as part of
// the writing (it has the class note-format).

import { Plugin } from 'prosemirror-state';
import { setBlockType, toggleMark } from 'prosemirror-commands';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import { plainRefs, PIGMENTS, schema, spanOfRef } from './note-doc.js';
import { openRef, selectedRef } from './note-quotes.js';

/** @typedef {import('prosemirror-state').EditorState} State */
/** @typedef {import('prosemirror-view').EditorView} View */

/** Whether every part of the selection has a mark (with these attributes). */
function marked(/** @type {State} */ state, /** @type {import('prosemirror-model').MarkType} */ type, attrs = {}) {
  const { from, to, empty } = state.selection;
  const has = (/** @type {readonly import('prosemirror-model').Mark[]} */ marks) =>
    marks.some((mark) => mark.type === type && Object.entries(attrs).every(([key, value]) => mark.attrs[key] === value));
  if (empty) return has(state.storedMarks ?? state.selection.$from.marks());
  let all = true;
  let any = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    any = true;
    if (!has(node.marks)) all = false;
  });
  return any && all;
}

/** The list the selection is in, if any: its type. */
function listOf(/** @type {State} */ state) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === schema.nodes.bullet_list || node.type === schema.nodes.ordered_list) return node.type;
  }
  return null;
}

/** @param {import('prosemirror-model').NodeType} type */
function toggleList(type) {
  return (/** @type {State} */ state, /** @type {View['dispatch']} */ dispatch) => {
    const now = listOf(state);
    if (now === type) return liftListItem(schema.nodes.list_item)(state, dispatch);
    if (now) {
      // The other kind of list: change its type in place.
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type === now) {
          dispatch?.(state.tr.setNodeMarkup($from.before(depth), type));
          return true;
        }
      }
    }
    if (wrapInList(type)(state)) return wrapInList(type)(state, dispatch);
    // A heading cannot start a list item: it becomes a paragraph first.
    const { from, to } = state.selection;
    const tr = state.tr.setBlockType(from, to, schema.nodes.paragraph);
    let done = false;
    wrapInList(type)(state.apply(tr), (wrap) => {
      for (const step of wrap.steps) tr.step(step);
      done = true;
    });
    if (done) dispatch?.(tr);
    return done;
  };
}

const heading = (/** @type {State} */ state) => state.selection.$from.parent.type === schema.nodes.heading;

/** @param {string} pigment */
function highlight(pigment) {
  return (/** @type {State} */ state, /** @type {View['dispatch']} */ dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    const type = schema.marks.highlight;
    const tr = state.tr.removeMark(from, to, type);
    if (!marked(state, type, { pigment })) tr.addMark(from, to, type.create({ pigment }));
    dispatch?.(tr);
    return true;
  };
}

/** A reference to verses, selected: it can open into a quote. */
const refSelected = (/** @type {State} */ state) => {
  const ref = selectedRef(state);
  return Boolean(ref && spanOfRef(ref.node.attrs.address));
};

/**
 * A format's command, whose change leaves references plain.
 *
 * @param {(state: State, dispatch?: View['dispatch']) => boolean} command
 */
const plainly = (command) => (/** @type {State} */ state, /** @type {View['dispatch'] | undefined} */ dispatch) =>
  command(state, dispatch && ((tr) => dispatch(plainRefs(tr))));

/** @type {{ name: string, label: string, icon?: string, pigment?: string, run: (state: State, dispatch?: View['dispatch']) => boolean, on: (state: State) => boolean, when?: (state: State) => boolean }[]} */
export const FORMATS = [
  { name: 'quote', label: 'Quote the verses', icon: 'quote', run: openRef, on: () => false, when: refSelected },
  { name: 'bold', label: 'Bold', icon: 'bold', run: plainly(toggleMark(schema.marks.strong)), on: (state) => marked(state, schema.marks.strong) },
  { name: 'italic', label: 'Italic', icon: 'italic', run: plainly(toggleMark(schema.marks.em)), on: (state) => marked(state, schema.marks.em) },
  {
    name: 'heading',
    label: 'Heading',
    icon: 'heading',
    run: (state, dispatch) => (heading(state) ? setBlockType(schema.nodes.paragraph) : setBlockType(schema.nodes.heading, { level: 1 }))(state, dispatch),
    on: heading,
  },
  { name: 'list', label: 'List', icon: 'list', run: toggleList(schema.nodes.bullet_list), on: (state) => listOf(state) === schema.nodes.bullet_list },
  { name: 'numbered', label: 'Numbered list', icon: 'list-numbered', run: toggleList(schema.nodes.ordered_list), on: (state) => listOf(state) === schema.nodes.ordered_list },
  ...PIGMENTS.map((pigment) => ({
    name: pigment,
    label: `Highlight in ${pigment}`,
    pigment,
    run: plainly(highlight(pigment)),
    on: (/** @type {State} */ state) => marked(state, schema.marks.highlight, { pigment }),
  })),
];

/** An icon of the app's set (icons/ui), as svg-icon draws it. */
function icon(/** @type {string} */ name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `/ui.svg#${name}`);
  svg.append(use);
  return svg;
}

export function formatBar() {
  /** @type {HTMLElement | null} */
  let bar = null;
  /** @type {View | null} */
  let editor = null;
  /** whether the last press was a finger's */
  let finger = false;
  const watch = (/** @type {PointerEvent} */ event) => {
    finger = event.pointerType === 'touch';
  };

  function hide() {
    bar?.remove();
    bar = null;
  }

  /** @param {View} view */
  function draw(view) {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'note-format';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Formatting');
      for (const button of FORMATS) {
        const element = document.createElement('button');
        element.type = 'button';
        element.tabIndex = -1;
        element.className = `note-format__button${button.pigment ? ` note-format__swatch note-format__swatch--${button.pigment}` : ''}`;
        element.dataset.format = button.name;
        element.setAttribute('aria-label', button.label);
        element.title = button.label;
        if (button.icon) element.append(icon(button.icon));
        if (button.name === 'list' || button.pigment === PIGMENTS[0]) bar.append(Object.assign(document.createElement('span'), { className: 'note-format__gap' }));
        bar.append(element);
      }
      // A press keeps the words selected, and formats them.
      bar.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const target = event.target instanceof Element ? event.target.closest('[data-format]') : null;
        const button = FORMATS.find((each) => each.name === (target instanceof HTMLElement ? target.dataset.format : ''));
        if (button && editor) {
          button.run(editor.state, editor.dispatch);
          editor.focus();
        }
      });
      // A keyboard's or a switch's click, with no pointer.
      bar.addEventListener('click', (event) => {
        if (/** @type {MouseEvent} */ (event).detail !== 0) return;
        const target = event.target instanceof Element ? event.target.closest('[data-format]') : null;
        const button = FORMATS.find((each) => each.name === (target instanceof HTMLElement ? target.dataset.format : ''));
        if (button && editor) button.run(editor.state, editor.dispatch);
      });
      document.body.append(bar);
    }
    // A reference selected: only Quote. Words selected: all but Quote.
    const ref = refSelected(view.state);
    for (const button of FORMATS) {
      const element = bar.querySelector(`[data-format="${button.name}"]`);
      if (!(element instanceof HTMLElement)) continue;
      element.hidden = button.name === 'quote' ? !ref : ref;
      element.setAttribute('aria-pressed', String(button.on(view.state)));
    }
    for (const gap of bar.querySelectorAll('.note-format__gap')) /** @type {HTMLElement} */ (gap).hidden = ref;
    // Over the words, or under them for a finger, and on the screen.
    const { from, to } = view.state.selection;
    let start;
    let end;
    try {
      start = view.coordsAtPos(from);
      end = view.coordsAtPos(to);
    } catch {
      return hide();
    }
    const port = visualViewport;
    const top = (port?.offsetTop ?? 0) + 8;
    const bottom = (port?.offsetTop ?? 0) + (port?.height ?? innerHeight) - 8;
    const right = (port?.offsetLeft ?? 0) + (port?.width ?? innerWidth) - 8;
    const height = bar.offsetHeight;
    const width = bar.offsetWidth;
    const middle = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;
    const over = Math.min(start.top, end.top) - 10 - height;
    const under = Math.max(start.bottom, end.bottom) + 12;
    const y = finger ? (under + height <= bottom ? under : over) : over >= top ? over : under;
    bar.style.left = `${Math.max(8, Math.min(middle - width / 2, right - width))}px`;
    bar.style.top = `${Math.max(top, Math.min(y, bottom - height))}px`;
  }

  return new Plugin({
    view(view) {
      editor = view;
      view.dom.addEventListener('pointerdown', watch);
      return {
        update(view) {
          editor = view;
          const { selection } = view.state;
          if (selection.empty || !view.hasFocus()) return hide();
          // A reference alone takes no format: the bar shows only to quote
          // its verses, and not at all for a person, place or word.
          if (selectedRef(view.state) && !refSelected(view.state)) return hide();
          draw(view);
        },
        destroy() {
          view.dom.removeEventListener('pointerdown', watch);
          hide();
          editor = null;
        },
      };
    },
  });
}
