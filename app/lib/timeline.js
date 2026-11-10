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

// The strip as narrow as it is drawn (a laptop), and the width of one
// letter of a span's name, in pixels: so a name's room on the strip can be
// worked out on the server. On a wider strip the names have more room.
export const STRIP_PX = 1300;
const LETTER_PX = 8;
const NAME_PAD_PX = 14;

/**
 * The world-history spans, by region, packed into lanes so that no two spans
 * in a lane overlap on the strip, and no name runs into the next span. A name
 * that does not fit inside its span goes just after it (`outside`), and the
 * lane keeps that room free. Regions keep the order they first appear in;
 * inside a region, spans go in by start.
 *
 * @param {Span[]} spans
 * @param {Era[]} [eras]
 * @param {number} [stripPx] the width of the strip, in pixels
 * @returns {{ name: string, lanes: (PlacedSpan & { outside: boolean })[][] }[]}
 */
export function packLanes(spans, eras = ERAS, stripPx = STRIP_PX) {
  /** @type {Map<string, (PlacedSpan & { outside: boolean, ends: number })[][]>} */
  const regions = new Map();
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  for (const region of new Set(spans.map((span) => span.region))) regions.set(region, []);
  for (const span of sorted) {
    const at = positionOf(span.start, eras);
    const width = Math.max(positionOf(span.end, eras) - at, 0.002);
    const name = (span.name.length * LETTER_PX + NAME_PAD_PX) / stripPx;
    const outside = name > width;
    // Where the span stops taking room: its end, or its name's end.
    const ends = outside ? at + width + name : at + width;
    const lanes = /** @type {(PlacedSpan & { outside: boolean, ends: number })[][]} */ (regions.get(span.region));
    const placed = { ...span, at, width, outside, ends };
    const lane = lanes.find((each) => /** @type {{ ends: number }} */ (each.at(-1)).ends <= at);
    if (lane) lane.push(placed);
    else lanes.push([placed]);
  }
  return [...regions].map(([name, lanes]) => ({
    name,
    lanes: lanes.map((lane) => lane.map(({ ends, ...span }) => span)),
  }));
}
