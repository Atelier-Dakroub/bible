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

/**
 * @typedef {{ id: string, name: string, label: string, region: string, start: number, end: number }} Span
 * @typedef {Span & { at: number, width: number }} PlacedSpan
 */

/**
 * The world-history spans, by region, packed into lanes so that no two spans
 * in a lane overlap on the strip. Regions keep the order they first appear
 * in; inside a region, spans go in by start.
 *
 * @param {Span[]} spans
 * @param {Era[]} [eras]
 * @returns {{ name: string, lanes: PlacedSpan[][] }[]}
 */
export function packLanes(spans, eras = ERAS) {
  /** @type {Map<string, PlacedSpan[][]>} */
  const regions = new Map();
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  for (const region of new Set(spans.map((span) => span.region))) regions.set(region, []);
  for (const span of sorted) {
    const at = positionOf(span.start, eras);
    const width = Math.max(positionOf(span.end, eras) - at, 0.002);
    const lanes = /** @type {PlacedSpan[][]} */ (regions.get(span.region));
    const placed = { ...span, at, width };
    const lane = lanes.find((each) => {
      const last = /** @type {PlacedSpan} */ (each.at(-1));
      return last.at + last.width <= at;
    });
    if (lane) lane.push(placed);
    else lanes.push([placed]);
  }
  return [...regions].map(([name, lanes]) => ({ name, lanes }));
}
