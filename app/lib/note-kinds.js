// The kinds of note (Joe's choice, 2026-11-11): the four of an inductive
// study, in its order (see, ask, explain, apply), and Prayer. A note with no
// kind is a plain Note. A tap on a note's label goes to the next kind; a
// Question has an Answered box, and the search panel lists the open ones.

/** @typedef {'observation' | 'question' | 'interpretation' | 'application' | 'prayer'} Kind */

/** @type {{ key: Kind, label: string, plural: string }[]} */
export const KINDS = [
  { key: 'observation', label: 'Observation', plural: 'Observations' },
  { key: 'question', label: 'Question', plural: 'Questions' },
  { key: 'interpretation', label: 'Interpretation', plural: 'Interpretations' },
  { key: 'application', label: 'Application', plural: 'Applications' },
  { key: 'prayer', label: 'Prayer', plural: 'Prayers' },
];

/** @param {unknown} value @returns {value is Kind} */
export const isKind = (value) => KINDS.some((each) => each.key === value);

/** The label of a kind, or "Note". @param {string | undefined} kind */
export const labelOf = (kind) => KINDS.find((each) => each.key === kind)?.label ?? 'Note';

/**
 * The kind after this one: Note, then each kind in order, then Note again.
 *
 * @param {string | undefined} kind
 * @returns {Kind | undefined}
 */
export function nextKind(kind) {
  const at = KINDS.findIndex((each) => each.key === kind);
  return at === KINDS.length - 1 ? undefined : KINDS[at + 1].key;
}
