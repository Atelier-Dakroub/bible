# bible

A multi-touch research surface for the Bible. The text goes on a table as
cards that you move, turn, scale, highlight and connect. The app is built
with [transclude](https://transclude.dev).

The table itself is not built yet. This version has the KJV data and a touch
test page for the panel.

```sh
npm install
npm run dev      # http://localhost:1960
npm test         # the gesture math, the import parser and the KJV data
npm run check    # types
```

## Layout

| Path | What it holds |
| --- | --- |
| `app/routes/` | Pages. `touch.html` is the touch test. |
| `app/elements/` | Custom elements: `touch-probe`, `calibration-target`, `gesture-card`, `kjv-verse`. |
| `app/lib/` | Browser modules with no DOM dependency where possible: `affine.js`, `gesture.js`, `pointer-log.js`. |
| `app/data/kjv/` | The KJV, one JSON file per book, made by the import. |
| `tools/` | The import script and its parser. |
| `docs/touch-setup.md` | How to connect the touch panel through a Linux VM in UTM. |

## The KJV data

`app/data/kjv/<BOOK>.json` holds a book as chapters of verses. A verse is a
list of blocks, and a block is a list of runs:

```json
{ "n": 1, "id": "PSA.3.1", "org": "PSA.3.2", "blocks": [
  { "style": "d", "runs": [{ "text": "A Psalm of David, when he fled from Absalom his son.", "marks": [] }] },
  { "style": "q1", "numbered": true, "runs": [
    { "text": "LORD", "marks": ["nd"] },
    { "text": ", how are they increased that trouble me! many ", "marks": [] },
    { "text": "are", "marks": ["add"] },
    { "text": " they that rise up against me.", "marks": [] }
  ] }
] }
```

- `style` is the USFM paragraph style: `p` prose, `q1` poetry, `d` a psalm
  title, `b` a stanza break, `s1` a heading.
- `marks` are the character styles: `add` supplied words (italics), `nd` the
  divine name, `wj` the words of Jesus, `tl` a Psalm 119 letter heading.
- `org` is the verse's number in the original-language versification. It is
  present only where it differs (1,969 verses).
- `books.json` lists the books with the verse count of each chapter.

To make the files again from
[data_bible-json](https://github.com/joe-dakroub/data_bible-json):

```sh
npm run import:kjv -- <path to data_bible-json>
```

The source is an API.Bible export. The KJV text is in the public domain
(except for the Crown patent in the UK), but read API.Bible's terms, or rebuild
from a public-domain source, before you publish the app on a public site.
`app/data/kjv/source.json` records this.
