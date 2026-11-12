// The formatting bar of a note being written (a ProseMirror plugin, for
// lib/note-editing.js): over the words a finger or the mouse selects, so the
// formatting is as direct as the rest of the table. Bold, italic, heading,
// list, numbered list, and a highlight in ochre, lapis or verdigris (and,
// for a reference to verses, Quote, which opens it into their words); a
// pressed button shows what the words already have, and a press again takes
// it off. With a finger, the bar sits under the words, clear of the phone's
// own menu over them. The keys do the same: Mod-B, Mod-I, "# ", "- ", "1. ".
// With the keyboard alone, Alt-F10 goes into the bar; the arrow keys, Home
// and End move along it; Enter or Space formats the words; and Escape or Tab
// goes back to them.
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

/** @param {EventTarget | null} target the format of the button it is on, if any */
function formatAt(target) {
  const element = target instanceof Element ? target.closest('[data-format]') : null;
  const name = element instanceof HTMLElement ? element.dataset.format : '';
  return FORMATS.find((each) => each.name === name);
}

/** @param {typeof FORMATS[number]} button its button in the bar */
function formatButton(button) {
  const element = document.createElement('button');
  element.type = 'button';
  element.tabIndex = -1;
  element.className = `note-format__button${button.pigment ? ` note-format__swatch note-format__swatch--${button.pigment}` : ''}`;
  element.dataset.format = button.name;
  element.setAttribute('aria-label', button.label);
  element.title = button.label;
  if (button.icon) element.append(icon(button.icon));
  return element;
}

/** The bar's buttons, with a gap before the lists and the highlights. */
function barButtons() {
  /** @type {HTMLElement[]} */
  const parts = [];
  for (const button of FORMATS) {
    if (button.name === 'list' || button.pigment === PIGMENTS[0]) parts.push(Object.assign(document.createElement('span'), { className: 'note-format__gap' }));
    parts.push(formatButton(button));
  }
  return parts;
}

/**
 * Each button pressed or not, as the words are. A reference selected: only
 * Quote. Words selected: all but Quote.
 *
 * @param {HTMLElement} bar
 * @param {State} state
 */
function paintButtons(bar, state) {
  const ref = refSelected(state);
  for (const button of FORMATS) {
    const element = bar.querySelector(`[data-format="${button.name}"]`);
    if (!(element instanceof HTMLElement)) continue;
    element.hidden = button.name === 'quote' ? !ref : ref;
    element.setAttribute('aria-pressed', String(button.on(state)));
  }
  for (const gap of bar.querySelectorAll('.note-format__gap')) /** @type {HTMLElement} */ (gap).hidden = ref;
}

/** @type {Record<string, (at: number, count: number) => number>} where each key moves along the bar */
const STEPS = {
  ArrowRight: (at, count) => (at + 1) % count,
  ArrowDown: (at, count) => (at + 1) % count,
  ArrowLeft: (at, count) => (at - 1 + count) % count,
  ArrowUp: (at, count) => (at - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * The button a key moves to, along a bar of `count` buttons from the one at
 * `at` (-1: none yet); null for a key that does not move.
 *
 * @param {string} key
 * @param {number} at
 * @param {number} count
 */
export function stepAlong(key, at, count) {
  const step = Object.hasOwn(STEPS, key) ? STEPS[key] : null;
  return step && count > 0 ? step(Math.max(at, 0), count) : null;
}

/** @param {HTMLElement} bar the buttons that show */
const shown = (bar) => /** @type {HTMLElement[]} */ ([...bar.querySelectorAll('button:not([hidden])')]);

/**
 * The box of the selected words on the screen; null if the editor cannot
 * say (it is being drawn again).
 *
 * @param {View} view
 */
function wordsBox(view) {
  const { from, to } = view.state.selection;
  try {
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    return { left: Math.min(start.left, end.left), right: Math.max(start.right, end.right), top: Math.min(start.top, end.top), bottom: Math.max(start.bottom, end.bottom) };
  } catch {
    return null;
  }
}

/** The part of the screen the bar stays in: what shows, less a margin. */
function screenBox() {
  const port = visualViewport ?? { offsetTop: 0, offsetLeft: 0, height: innerHeight, width: innerWidth };
  return { top: port.offsetTop + 8, bottom: port.offsetTop + port.height - 8, right: port.offsetLeft + port.width - 8 };
}

/**
 * Where the bar goes: over the words, or under them for a finger (clear of
 * the phone's own menu over them), on the other side when there is no
 * room, and always on the screen.
 *
 * @param {{ left: number, right: number, top: number, bottom: number }} words
 * @param {{ width: number, height: number }} bar
 * @param {{ top: number, bottom: number, right: number }} screen
 * @param {boolean} finger
 */
export function barPosition(words, bar, screen, finger) {
  const middle = (words.left + words.right) / 2;
  const over = words.top - 10 - bar.height;
  const under = words.bottom + 12;
  const y = (finger ? under + bar.height <= screen.bottom : over < screen.top) ? under : over;
  return {
    left: Math.max(8, Math.min(middle - bar.width / 2, screen.right - bar.width)),
    top: Math.max(screen.top, Math.min(y, screen.bottom - bar.height)),
  };
}

/**
 * Whether the note is being written: the focus is in it, or in its bar.
 *
 * @param {View} view
 * @param {HTMLElement | null} bar
 */
const focusedIn = (view, bar) => view.hasFocus() || Boolean(bar?.contains(document.activeElement));

/**
 * Whether the selection takes a format. A reference alone takes none: the
 * bar shows only to quote its verses, and not at all for a person, place or
 * word.
 *
 * @param {State} state
 */
const formattable = (state) => !selectedRef(state) || refSelected(state);

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
    bar ??= makeBar();
    paintButtons(bar, view.state);
    const words = wordsBox(view);
    if (!words) return hide();
    const spot = barPosition(words, { width: bar.offsetWidth, height: bar.offsetHeight }, screenBox(), finger);
    bar.style.left = `${spot.left}px`;
    bar.style.top = `${spot.top}px`;
  }

  /** The bar, made and put on the page. */
  function makeBar() {
    const made = document.createElement('div');
    made.className = 'note-format';
    made.setAttribute('role', 'toolbar');
    made.setAttribute('aria-label', 'Formatting');
    made.append(...barButtons());
    // A press keeps the words selected, and formats them.
    made.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      press(event.target);
    });
    // A keyboard's or a switch's click, with no pointer.
    made.addEventListener('click', (event) => {
      if (/** @type {MouseEvent} */ (event).detail === 0) press(event.target);
    });
    made.addEventListener('keydown', (event) => key(made, event));
    document.body.append(made);
    return made;
  }

  /**
   * A key in the bar: along it, or back to the words.
   *
   * @param {HTMLElement} made
   * @param {KeyboardEvent} event
   */
  function key(made, event) {
    const buttons = shown(made);
    const to = stepAlong(event.key, buttons.indexOf(/** @type {HTMLElement} */ (document.activeElement)), buttons.length);
    if (to !== null) buttons[to].focus();
    else if (event.key === 'Escape' || event.key === 'Tab') editor?.focus();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Formats the words with the button pressed. The note has the focus first,
   * so the bar stays for the words.
   *
   * @param {EventTarget | null} target
   */
  function press(target) {
    const button = formatAt(target);
    if (!button || !editor) return;
    editor.focus();
    button.run(editor.state, editor.dispatch);
  }

  return new Plugin({
    props: {
      // Alt-F10: into the bar, while it shows.
      handleKeyDown(view, event) {
        if (!(event.altKey && event.key === 'F10' && bar)) return false;
        shown(bar)[0]?.focus();
        return true;
      },
    },
    view(view) {
      editor = view;
      view.dom.addEventListener('pointerdown', watch);
      return {
        update(view) {
          editor = view;
          if (view.state.selection.empty || !focusedIn(view, bar) || !formattable(view.state)) return hide();
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
