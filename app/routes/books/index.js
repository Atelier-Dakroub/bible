// The books, with the verses of each chapter, as JSON: what the table needs
// to find references in pasted text (lib/citations.js, pastedReferences), so that
// the pasted text itself never leaves the browser.
//   GET /books  ->  [{ "id": "GEN", "name": "Genesis", "abbreviation": "Gen", "verses": [31, 25, …] }, …]

import { books } from '../../data/bible.js';

export const GET = () =>
  Response.json(
    books.map(({ id, name, abbreviation, verses }) => ({ id, name, abbreviation, verses })),
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
