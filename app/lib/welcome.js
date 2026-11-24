// The first table: what a reader sees the first time the table opens in a
// browser, so that they see how it works before they put anything down. Two
// passages that begin with the same words, those words marked on each and
// linked, a note that tells what to try, and a search for the same words in
// the search panel. All of it is an ordinary table: the reader moves it,
// changes it or clears it as any other. It comes once: after it, the browser
// keeps the reader's own table (lib/workspace.js), even an empty one.

import { KEY } from './workspace.js';

/** The passages, side by side. */
export const PASSAGES = ['GEN.1.1-5', 'JHN.1.1-5'];

/** "In the beginning", in each of them. */
export const HIGHLIGHTS = [
  { from: 'GEN.1.1.w1', to: 'GEN.1.1.w3' },
  { from: 'JHN.1.1.w1', to: 'JHN.1.1.w3' },
];

/** A link between the two marks. */
export const LINKS = [{ a: HIGHLIGHTS[1], b: HIGHLIGHTS[0] }];

/** The search in the panel. */
export const SEARCH = 'In the beginning';

/** The note, in the outline of lib/note-doc.js fromOutline. */
export const NOTE = {
  title: 'Start here',
  text: [
    'This is the table. Each thing on it is a card. Move these cards, change them, or take them away.',
    '## Try these',
    'Drag a card to move it. Drag the empty table to move the table. Pinch, or use − and + in the corner, to zoom.',
    'Tap a word for its study. Tap the heading of a passage for its guide.',
    'Genesis and John begin with the same words. Those words are marked on both cards, and the line links them.',
    'To mark words, hold the card with one finger, and run a finger of the other hand over the words. With a mouse, hold Option (Alt) and drag.',
    'In the search panel, type a word, a name or a reference. Tap a result to put it on the table.',
    'Tap × to take a card away. Undo brings it back. For more, open the guide from Tools.',
  ].join('\n'),
};

/**
 * Whether this browser has never kept a table: the first visit. A browser
 * that cannot keep one is not on its first visit, or every visit would be.
 *
 * @param {Pick<Storage, 'getItem'>} [storage]
 */
export function firstVisit(storage = globalThis.localStorage) {
  try {
    return storage.getItem(KEY) === null;
  } catch {
    return false;
  }
}
