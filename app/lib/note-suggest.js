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
    if (!list) {
      list = document.createElement('div');
      list.className = 'note-suggest';
      list.id = id;
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', 'Suggestions');
      // A press keeps the caret in the note, and picks.
      list.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const item = event.target instanceof Element ? event.target.closest('[data-index]') : null;
        if (item instanceof HTMLElement && editor) accept(editor, Number(item.dataset.index));
      });
      document.body.append(list);
    }
    const { items, active, trigger } = open;
    list.replaceChildren(
      ...items.map((item, index) => {
        const option = document.createElement('div');
        option.className = `note-suggest__item note-suggest__item--${item.kind}`;
        option.id = `${id}-${index}`;
        option.dataset.index = String(index);
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(index === active));
        const label = document.createElement('span');
        label.className = 'note-suggest__label';
        label.textContent = item.label;
        const detail = document.createElement('span');
        detail.className = 'note-suggest__detail';
        detail.textContent = item.detail;
        option.append(label, detail);
        return option;
      }),
      Object.assign(document.createElement('p'), {
        className: 'note-suggest__hint',
        textContent: trigger.kind === 'at' ? 'Enter or Tab to link' : 'Tab to link · Enter for a new line',
      }),
    );
    view.dom.setAttribute('aria-controls', id);
    view.dom.setAttribute('aria-expanded', 'true');
    view.dom.setAttribute('aria-activedescendant', `${id}-${active}`);
    // Under the words, or over them where the screen ends.
    let at;
    try {
      at = view.coordsAtPos(trigger.from);
    } catch {
      return close();
    }
    const port = visualViewport;
    const bottom = (port?.offsetTop ?? 0) + (port?.height ?? innerHeight);
    const right = (port?.offsetLeft ?? 0) + (port?.width ?? innerWidth);
    const height = list.offsetHeight;
    const width = list.offsetWidth;
    list.style.left = `${Math.max(8, Math.min(at.left, right - width - 8))}px`;
    list.style.top = `${at.bottom + 6 + height > bottom ? Math.max(8, at.top - 6 - height) : at.bottom + 6}px`;
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
    let found = cache.get(key);
    if (!found) {
      found = fetch(`/suggest/${encodeURIComponent(trigger.text)}?kind=${trigger.kind}`)
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []);
      cache.set(key, found);
    }
    const items = await found;
    if (asked !== key || view.isDestroyed) return;
    const now = triggerOf(view.state);
    if (!now || now.from !== trigger.from || now.from === dismissed) return;
    if (!items.length) return close();
    open = { trigger: now, items, active: 0 };
    draw(view);
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
          if (!trigger || trigger.from === dismissed) {
            clearTimeout(timer);
            asked = '';
            return close();
          }
          if (open && open.trigger.from !== trigger.from) close();
          if (open) {
            open.trigger = trigger;
            draw(view);
          }
          clearTimeout(timer);
          timer = setTimeout(() => look(view, trigger), WAIT_MS);
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
        const count = open.items.length;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          open.active = (open.active + (event.key === 'ArrowDown' ? 1 : count - 1)) % count;
          draw(view);
          return true;
        }
        if (event.key === 'Tab' || (event.key === 'Enter' && open.trigger.kind === 'at')) {
          accept(view, open.active);
          return true;
        }
        if (event.key === 'Escape') {
          dismissed = open.trigger.from;
          close();
          return true;
        }
        return false;
      },
    },
  });
}
