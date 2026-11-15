// The reader's own notes in a search: those on the table, and those in the
// tables saved under a name (lib/workspace.js). They live in this browser,
// so they are searched here, and the words searched for never go to the
// server for them.
//
// A note matches when every word of the search, of two letters or more, is
// in its title or its words. Case and accents do not matter: "esau" finds
// "Esaú".

/** @typedef {{ id: string, title?: string, text: string, kind?: string, answered?: boolean }} SearchedNote */

/**
 * Text for comparing: lower case, without accents.
 *
 * @param {string} text
 */
export function fold(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * The words of a search that count: two letters or more.
 *
 * @param {string} query
 */
function wordsOf(query) {
  return fold(query)
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

/**
 * Some words of a note around the first word searched for, so the list shows
 * why the note matched.
 *
 * @param {string} text
 * @param {string[]} words folded
 * @param {number} [width]
 */
export function snippet(text, words, width = 120) {
  const folded = fold(text);
  const at = Math.min(...words.map((word) => folded.indexOf(word)).filter((index) => index >= 0));
  const start = Number.isFinite(at) ? Math.max(0, at - 40) : 0;
  const cut = text.slice(start, start + width).trim();
  return `${start > 0 ? '…' : ''}${cut}${start + width < text.length ? '…' : ''}`;
}

/**
 * The notes that match a search, each with the words to show for it.
 *
 * @param {string} query
 * @param {SearchedNote[]} notes
 * @param {number} [limit]
 * @returns {SearchedNote[]} `text` is the snippet
 */
export function notesMatching(query, notes, limit = 20) {
  const words = wordsOf(query);
  if (!words.length) return [];
  return notes
    .filter((note) => {
      const searched = fold(`${note.title ?? ''} ${note.text}`);
      return words.every((word) => searched.includes(word));
    })
    .slice(0, limit)
    .map((note) => ({ ...note, text: snippet(note.text, words) }));
}
