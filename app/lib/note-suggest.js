// Suggestions as a note is written (a ProseMirror plugin, for
// lib/note-editing.js). Two kinds:
//   - words that read as a reference, just before the caret ("John 3:16",
//     "Jn 3"): the passage, with its first words. Tab or a tap makes it a
//     reference; Enter still starts a new line.
//   - @ and a name ("@abra", "@H430", "@agape"): people, places, groups,
//     events and words of the original. Enter, Tab or a tap makes one a
//     reference.
// Up and Down choose; Escape puts the suggestions away until the words
// change. The suggestions come from the server (routes/suggest/[text].js).
// The list is outside the card, so the table counts a press on it as part of
// the writing (it has the class note-suggest).

import { Plugin } from 'prosemirror-state';
import { schema } from './note-doc.js';

const AT = /(?:^|[\s(])@([\p{L}\p{N}][\p{L}\p{N}'’ -]{0,28})$/u;
const REF = /(?:^|[\s(])((?:[1-3] ?)?[A-Za-z][A-Za-z.]{1,15} \d{1,3}(?::\d{1,3}(?:[-–]\d{1,3})?)?)$/;
const WAIT_MS = 120;

/** @typedef {{ kind: 'at' | 'ref', text: string, from: number, to: number }} Trigger */
/** @typedef {{ kind: string, address: string, label: string, detail: string }} Suggestion */

/**
 * What the words just before the caret ask for, if anything.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @returns {Trigger | null}
 */
export function triggerOf(state) {
  const { selection } = state;
  if (!selection.empty) return null;
  const $at = selection.$from;
  if (!$at.parent.isTextblock) return null;
  // A reference or a line break counts as one character, as in the document.
  const before = $at.parent.textBetween(0, $at.parentOffset, '\0', '\0');
  const named = AT.exec(before);
  if (named) return { kind: 'at', text: named[1].trimEnd(), from: $at.pos - named[1].length - 1, to: $at.pos };
  const ref = REF.exec(before);
  if (ref) return { kind: 'ref', text: ref[1], from: $at.pos - ref[1].length, to: $at.pos };
  return null;
}

let lists = 0;

/**
 * Where the list goes: under the words, or over them where the screen
 * ends, and always on the screen.
 *
 * @param {{ left: number, top: number, bottom: number }} at the words' start
 * @param {{ width: number, height: number }} list
 * @param {{ bottom: number, right: number }} screen
 */
export function listPosition(at, list, screen) {
  const below = at.bottom + 6;
  return {
    left: Math.max(8, Math.min(at.left, screen.right - list.width - 8)),
    top: below + list.height > screen.bottom ? Math.max(8, at.top - 6 - list.height) : below,
  };
}

/** The part of the screen that shows: its bottom and its right edge. */
function screenEdge() {
  const port = visualViewport ?? { offsetTop: 0, offsetLeft: 0, height: innerHeight, width: innerWidth };
  return { bottom: port.offsetTop + port.height, right: port.offsetLeft + port.width };
}

/**
 * Where a position is on the screen; null if the editor cannot say (it is
 * being drawn again).
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {number} pos
 */
function coordsOf(view, pos) {
  try {
    return view.coordsAtPos(pos);
  } catch {
    return null;
  }
}

/**
 * A suggestion in the list.
 *
 * @param {Suggestion} item
 * @param {number} index
 * @param {boolean} active
 * @param {string} id the list's
 */
function optionOf(item, index, active, id) {
  const option = document.createElement('div');
  option.className = `note-suggest__item note-suggest__item--${item.kind}`;
  option.id = `${id}-${index}`;
  option.dataset.index = String(index);
  option.setAttribute('role', 'option');
  option.setAttribute('aria-selected', String(active));
  const label = Object.assign(document.createElement('span'), { className: 'note-suggest__label', textContent: item.label });
  const detail = Object.assign(document.createElement('span'), { className: 'note-suggest__detail', textContent: item.detail });
  option.append(label, detail);
  return option;
}

/**
 * The list box of the suggestions.
 *
 * @param {HTMLElement[]} options
 * @param {string} id
 */
function listboxOf(options, id) {
  const box = Object.assign(document.createElement('div'), { id });
  box.setAttribute('role', 'listbox');
  box.setAttribute('aria-label', 'Suggestions');
  box.append(...options);
  return box;
}

/** @param {Trigger['kind']} kind the hint under the list: what the keys do */
const hintOf = (kind) =>
  Object.assign(document.createElement('p'), {
    className: 'note-suggest__hint',
    textContent: kind === 'at' ? 'Enter or Tab to link' : 'Tab to link · Enter for a new line',
  });

export function suggestions() {
  /** @type {Map<string, Promise<Suggestion[]>>} */
  const cache = new Map();
  /** @type {{ trigger: Trigger, items: Suggestion[], active: number } | null} */
  let open = null;
  /** the start of the words whose suggestions Escape put away */
  let dismissed = -1;
  /** @type {HTMLElement | null} */
  let list = null;
  /** @type {import('prosemirror-view').EditorView | null} */
  let editor = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  let asked = '';
  const id = `note-suggest-${(lists += 1)}`;

  function close() {
    open = null;
    list?.remove();
    list = null;
    if (editor && !editor.isDestroyed) {
      editor.dom.removeAttribute('aria-activedescendant');
      editor.dom.setAttribute('aria-expanded', 'false');
    }
  }

  /** @param {import('prosemirror-view').EditorView} view */
  function draw(view) {
    if (!open) return;
    list ??= makeList();
    const { items, active, trigger } = open;
    // The hint is under the list box, not in it: a list box holds options
    // only.
    list.replaceChildren(listboxOf(items.map((item, index) => optionOf(item, index, index === active, id)), id), hintOf(trigger.kind));
    view.dom.setAttribute('aria-controls', id);
    view.dom.setAttribute('aria-expanded', 'true');
    view.dom.setAttribute('aria-activedescendant', `${id}-${active}`);
    const at = coordsOf(view, trigger.from);
    if (!at) return close();
    const spot = listPosition(at, { width: list.offsetWidth, height: list.offsetHeight }, screenEdge());
    list.style.left = `${spot.left}px`;
    list.style.top = `${spot.top}px`;
  }

  /** The list, made and put on the page. A press keeps the caret in the note, and picks. */
  function makeList() {
    const made = document.createElement('div');
    made.className = 'note-suggest';
    made.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const item = event.target instanceof Element ? event.target.closest('[data-index]') : null;
      if (item instanceof HTMLElement && editor) accept(editor, Number(item.dataset.index));
    });
    document.body.append(made);
    return made;
  }

  /**
   * @param {import('prosemirror-view').EditorView} view
   * @param {number} index
   */
  function accept(view, index) {
    const item = open?.items[index];
    const trigger = triggerOf(view.state) ?? open?.trigger;
    if (!item || !trigger) return;
    const node = schema.nodes.ref.create({ address: item.address, label: item.label, kind: item.kind });
    const tr = view.state.tr.replaceWith(trigger.from, trigger.to, node);
    tr.insertText(' ', trigger.from + 1);
    close();
    view.dispatch(tr.scrollIntoView());
    view.focus();
  }

  /**
   * @param {import('prosemirror-view').EditorView} view
   * @param {Trigger} trigger
   */
  async function look(view, trigger) {
    const key = `${trigger.kind}:${trigger.text.toLowerCase()}`;
    asked = key;
    const items = await suggestionsFor(trigger, key);
    const now = current(view, trigger, key);
    if (!now) return;
    if (!items.length) return close();
    open = { trigger: now, items, active: 0 };
    draw(view);
  }

  /**
   * The suggestions for the words, asked of the server once.
   *
   * @param {Trigger} trigger
   * @param {string} key
   */
  function suggestionsFor(trigger, key) {
    let found = cache.get(key);
    if (!found) {
      found = fetch(`/suggest/${encodeURIComponent(trigger.text)}?kind=${trigger.kind}`)
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []);
      cache.set(key, found);
    }
    return found;
  }

  /**
   * The words before the caret, if the answer is still for them: no other
   * words were asked about since, and Escape did not put them away.
   *
   * @param {import('prosemirror-view').EditorView} view
   * @param {Trigger} trigger
   * @param {string} key
   */
  function current(view, trigger, key) {
    if (asked !== key || view.isDestroyed) return null;
    return sameWords(triggerOf(view.state), trigger.from);
  }

  /**
   * The words before the caret, if they start where the asked words did and
   * Escape did not put them away.
   *
   * @param {Trigger | null} now
   * @param {number} from
   */
  function sameWords(now, from) {
    return now && now.from === from && from !== dismissed ? now : null;
  }

  /** No words to suggest for: nothing more is asked, and the list goes. */
  function stop() {
    clearTimeout(timer);
    asked = '';
    close();
  }

  /**
   * The words change: the list follows them, and the server is asked again
   * a moment after the last change.
   *
   * @param {import('prosemirror-view').EditorView} view
   * @param {Trigger} trigger
   */
  function follow(view, trigger) {
    if (open && open.trigger.from !== trigger.from) close();
    if (open) {
      open.trigger = trigger;
      draw(view);
    }
    clearTimeout(timer);
    timer = setTimeout(() => look(view, trigger), WAIT_MS);
  }

  /**
   * What the keys do while the list shows: Up and Down choose, Tab picks
   * (and Enter, for @), and Escape puts the list away until the words
   * change. Each says whether it took the key.
   *
   * @param {import('prosemirror-view').EditorView} view
   * @param {{ trigger: Trigger, items: Suggestion[], active: number }} shown
   * @returns {Record<string, () => boolean>}
   */
  function keyActions(view, shown) {
    const count = shown.items.length;
    const move = (/** @type {number} */ step) => () => {
      shown.active = (shown.active + step + count) % count;
      draw(view);
      return true;
    };
    const pick = () => {
      accept(view, shown.active);
      return true;
    };
    return {
      ArrowDown: move(1),
      ArrowUp: move(-1),
      Tab: pick,
      Enter: () => shown.trigger.kind === 'at' && pick(),
      Escape: () => {
        dismissed = shown.trigger.from;
        close();
        return true;
      },
    };
  }

  return new Plugin({
    view(view) {
      editor = view;
      view.dom.setAttribute('aria-autocomplete', 'list');
      return {
        update(view) {
          editor = view;
          const trigger = triggerOf(view.state);
          if (!trigger) dismissed = -1;
          if (!trigger || trigger.from === dismissed) return stop();
          follow(view, trigger);
        },
        destroy() {
          clearTimeout(timer);
          close();
          editor = null;
        },
      };
    },
    props: {
      handleKeyDown(view, event) {
        if (!open) return false;
        const actions = keyActions(view, open);
        return Object.hasOwn(actions, event.key) ? actions[event.key]() : false;
      },
    },
  });
}
