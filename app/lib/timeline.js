// The time axis of the timeline strip.
//
// The events run from 4004 BC to AD 57, but most of the text is about a few
// centuries of that. A linear axis would give the four Gospels a sliver. So
// the axis is cut into eras of equal width, and time is linear inside each.
// The eras are this app's own grouping for reading the strip, not claims about
// history; their edges are round numbers near well-known events.
//
// Years are astronomical, as Theographic's are: -4003 is 4004 BC.

/** @typedef {{ name: string, from: number, to: number }} Era */

/** @type {Era[]} */
export const ERAS = [
  { name: 'Creation to the Flood', from: -4003, to: -2347 },
  { name: 'The Flood to the Exodus', from: -2347, to: -1490 },
  { name: 'The Exodus to Saul', from: -1490, to: -1094 },
  { name: 'The kingdoms', from: -1094, to: -585 },
  { name: 'Exile and return', from: -585, to: -399 },
  { name: 'Between the Testaments', from: -399, to: -4 },
  { name: 'The Gospels', from: -4, to: 30 },
  { name: 'Acts and the letters', from: 30, to: 100 },
];

/**
 * Where a year sits on the strip, from 0 at the left to 1 at the right.
 *
 * @param {number} year
 * @param {Era[]} [eras]
 */
export function positionOf(year, eras = ERAS) {
  const width = 1 / eras.length;
  if (year <= eras[0].from) return 0;
  for (const [i, era] of eras.entries()) {
    if (year <= era.to) return (i + (year - era.from) / (era.to - era.from)) * width;
  }
  return 1;
}

/**
 * A year as people write it: -4003 is "4004 BC", 30 is "AD 30".
 *
 * @param {number} year
 */
export function yearLabel(year) {
  return year <= 0 ? `${1 - year} BC` : `AD ${year}`;
}
