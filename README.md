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

Word studies: tap a word on a card. The search panel shows its Hebrew or
Greek word from Strong's dictionary, with the verses that use it, and every
word on the table that renders the same original word is underlined. A
search for a Strong's number, such as `H2617` or `G25`, does the same. A
button in the study switches to the verse's cross-references.

Cross-references: tap a word with no Strong's number (or use the button in a
word study), and the search panel lists the verse's cross-references, most
voted first. Pull them out like any result. A dotted
gray line joins a verse on one card to a verse on another when one refers to
the other. The references are OpenBible.info's (CC BY), from the Treasury of
Scripture Knowledge.

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
| `tools/` | The imports: `import-kjv.js` and its parser, `import-xrefs.js`, and `import-strongs.js`. |
| `app/data/strongs/` | The Strong's numbers, one JSON file per book, and the dictionary. |
| `app/data/xrefs/` | The cross-references, one JSON file per book, made by the import. |
| `docs/touch-setup.md` | How to connect the touch panel through a Linux VM in UTM. |

## Colors

A wireframe for now: black boxes with thin gray lines, white text, and red only
for the words of Christ. No rounded corners, shadows, fills or texture. Each
text color is checked with APCA on black: white Lc 108, gray Lc 76, red Lc 76.
`app/styles/global.css` lists the values and the rule for changing them.

## The Strong's data

`app/data/strongs/<BOOK>.json` gives each verse one Strong's number per word,
in word order, with `-` for a word that has none:
`{ "GEN.1.1": "- - H7225 H430 H1254 - H8064 H853 - H776" }`.
`app/data/strongs/lexicon.json` is the dictionary: lemma, transliteration,
pronunciation, definition and the KJV renderings for each number.

```sh
node tools/import-strongs.js <usfm directory> <strongs-hebrew-dictionary.js> <strongs-greek-dictionary.js>
```

- The numbers come from eBible.org's `eng-kjv2006_usfm.zip` (public domain).
  Its text is another edition of the same KJV, so the import matches words by
  spelling, verse by verse: 790,605 of 790,707 words match, and 45.7% of all
  words carry a number. Most of the rest are small words, such as "the" and
  "of", that the source does not tag.
- The dictionary is Open Scriptures' JSON edition of Strong's dictionaries
  ([openscriptures/strongs](https://github.com/openscriptures/strongs)),
  **CC BY-SA**. The app credits Open Scriptures wherever it shows an entry.
  Dictionary data that is published as data must keep the same license; the
  app's code is not affected.

## The cross-reference data

`app/data/xrefs/<BOOK>.json` maps each verse to its references, best first:
`{ "JHN.3.16": [["ROM.5.8", 992], ["1JN.4.9-10", 705], ...] }`. The number
is OpenBible.info's vote count. To make the files again from
[cross-references.zip](https://a.openbible.info/data/cross-references.zip):

```sh
node tools/import-xrefs.js <path to cross_references.txt>
```

The import keeps 341,354 references and drops 3,445: those with zero or fewer
votes, and one to a verse the KJV data does not have. A target that runs into
the next chapter stops at the end of its first chapter (655 targets), because
a card address holds one chapter. The license is CC BY, so the app credits
OpenBible.info wherever it lists references.

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
