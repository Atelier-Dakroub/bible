// The cross-references of the verses in a passage, as JSON:
//   GET /xrefs/JHN.3.14-18  ->  { "JHN.3.16": [["ROM.5.8", 992], ...], ... }
//
// The table asks for this once for each card, and draws a line where a verse on
// one card refers to a verse on another. The data is OpenBible.info's (CC BY).

import { books, referencesIn } from '../../data/bible.js';
import { parseAddress } from '../../lib/reference.js';

/** @param {{ params: Record<string, string> }} ctx */
export const GET = async ({ params }) => {
  const ref = parseAddress(params.address, books);
  if (!ref) return new Response('No passage has that address.', { status: 404 });
  return Response.json(await referencesIn(ref), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
};
