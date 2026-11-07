# bible

A multi-touch research surface for the Bible. The text goes on a table as
cards that you move, turn, scale, highlight and connect. The app is built
with [transclude](https://transclude.dev).

`/table` is the table: search the text, then tap a result or drag it out
sideways to put the passage on the table as a card. Cards move, turn and
scale; a drag on the empty table pans everything, and the table has no edge.
What is on the table is kept in the browser as addresses and positions.

Highlights take two hands: hold a card still with one finger, then run a
finger of the other hand over the words. A highlight is stored as a span of
word addresses (`JHN.3.16.w2` to `JHN.3.16.w6`), apart from the text, so
every card that holds those words shows it, in inverse. Marking the same span
again, or a tap on a highlighted word while you hold the card, removes it.

Links: while you mark words, drag the marking finger out of the card and lift
it on another card. That links the marked words to the highlight under your
finger, or to the whole passage when no highlight is there. A solid white line
shows a link; a dashed gray line joins the places where the same highlighted
words show on more than one card. Drawing a link again removes it, and
removing a highlight removes its links. A link is two spans of word
addresses, kept with the workspace.

Cards zoom semantically: below about half size, a card shows its short form
(heading, opening words, verse count), and a passage longer than 24 verses
arrives in that form. The search panel collapses to one box: "Hide" and
Escape close it, "Search" and "/" open it.

`/touch` is the touch test page for the panel.

```sh
npm install
npm run dev      # http://localhost:1960
npm test         # the gesture math, the import parser and the KJV data
npm run check    # types
npm run verify   # the tests, the types and a build: the build compiles every template
```

## Layout

| Path | What it holds |
| --- | --- |
| `app/routes/` | Pages. `table.html` is the table, `search.html` the search and its `results` fragment, `card/[address].html` one card as a fragment, `touch.html` the touch test. |
| `app/elements/` | Custom elements: `bible-table`, `passage-search`, `gesture-card`, `kjv-verse`, and for the touch test `touch-probe` and `calibration-target`. |
| `app/lib/` | Modules with no DOM dependency where possible: `affine.js`, `gesture.js`, `reference.js`, `words.js`, `links.js`, `workspace.js`, `pointer-log.js`. |
| `app/data/bible.js` | The server's access to the text: passages by reference, and search. |
| `app/data/kjv/` | The KJV, one JSON file per book, made by the import. |
| `tools/` | The import script and its parser. |
| `docs/touch-setup.md` | How to connect the touch panel through a Linux VM in UTM. |

## Colors

A wireframe for now: black boxes with thin gray lines, white text, and red only
for the words of Christ. No rounded corners, shadows, fills or texture. Each
text color is checked with APCA on black: white Lc 108, gray Lc 76, red Lc 76.
`app/styles/global.css` lists the values and the rule for changing them.

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
