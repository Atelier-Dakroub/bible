// The recordings of a passage, as JSON (data/audio.js), the app's own voice
// first:
//   GET /listen/JHN.3.16-18?version=kjv  ->  [{ "id": "plain-male-kjv", "kind": "own", "reader": "…",
//     "chapters": [{ "file": "/audio/plain-male/kjv/JHN.3.m4a", "verses": [{ "id": "JHN.3.16", "at": 412.3, "until": 431 }, …] }] }, …]
// or [] where there is none, and the card reads in the device's voice.

import { books } from '../../data/bible.js';
import { recordingsOf } from '../../data/audio.js';
import { parseAddress } from '../../lib/reference.js';

/** @param {{ params: Record<string, string>, request: Request }} ctx */
export const GET = async ({ params, request }) => {
  const ref = parseAddress(params.address, books);
  if (!ref) return new Response('No passage has that address.', { status: 404 });
  const version = new URL(request.url).searchParams.get('version') ?? 'kjv';
  return Response.json(await recordingsOf(ref, version), { headers: { 'Cache-Control': 'no-cache' } });
};
