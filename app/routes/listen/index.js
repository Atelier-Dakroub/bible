// The recorded voices of this copy of the app (data/audio.js), as JSON, so
// that Tools shows the choice of reader only where there is one:
//   GET /listen  ->  [{ "id": "plain-male-kjv", "version": "kjv", "reader": "…" }, …]
// or [] where recordings are off (no BIBLE_AUDIO), and the device reads.

import { recordings } from '../../data/audio.js';

export const GET = async () => {
  const found = (await recordings()).map(({ id, version, reader }) => ({ id, version, reader }));
  return Response.json(found, { headers: { 'Cache-Control': 'no-cache' } });
};
