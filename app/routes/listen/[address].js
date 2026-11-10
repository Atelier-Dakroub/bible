// Where a passage is in the KJV's recording, as JSON (data/audio.js):
//   GET /listen/JHN.3.16-18  ->  [{ "file": "/audio/JHN.3.m4a", "verses": [{ "id": "JHN.3.16", "at": 412.3, "until": 431 }, ...] }]
// or [] where there is no recording, and the card reads in the device's voice.

import { books } from '../../data/bible.js';
import { CREDIT, recordingOf } from '../../data/audio.js';
import { parseAddress } from '../../lib/reference.js';

/** @param {{ params: Record<string, string> }} ctx */
export const GET = async ({ params }) => {
  const ref = parseAddress(params.address, books);
  if (!ref) return new Response('No passage has that address.', { status: 404 });
  const chapters = await recordingOf(ref);
  return Response.json({ credit: CREDIT, chapters }, { headers: { 'Cache-Control': 'no-cache' } });
};
