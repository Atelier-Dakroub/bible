// The entities that the verses of a passage name, as JSON:
//   GET /entities/GEN.23.3-10  ->  { "GEN.23.10": ["person:ephron_1208", ...], ... }
//
// The table asks for this once for each card, to place the card's events on
// the timeline. The data is Theographic's (CC BY-SA).

import { books, passage } from '../../data/bible.js';
import { namedIn } from '../../data/entities.js';
import { parseAddress } from '../../lib/reference.js';

/** @param {{ params: Record<string, string> }} ctx */
export const GET = async ({ params }) => {
  const ref = parseAddress(params.address, books);
  if (!ref) return Response.json({});
  const [named, { verses }] = await Promise.all([namedIn(ref.book), passage(ref)]);
  /** @type {Record<string, string[]>} */
  const found = {};
  for (const verse of verses) if (named[verse.id]) found[verse.id] = named[verse.id];
  return Response.json(found, { headers: { 'Cache-Control': 'public, max-age=3600' } });
};
