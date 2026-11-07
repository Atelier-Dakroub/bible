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

People, places and the timeline: a word that names a person, place or group
(dotted underline) shows it in the search panel: dates, family, places,
Easton's dictionary text, and the verses that name it. Its relations are
buttons, and its heading pulls out as a card. A people's name with no linked
entity, such as "Hittite", shows its entry in Easton's dictionary. The
timeline strip at the bottom shows 450 events on an axis of equal-width eras;
the events that the cards on the table tell are marked, with a line from each
card. A tap on a tick shows the event.

The World button on the strip shows world history under the events: 48
empires, kingdoms and periods in six regions, from Wikidata, on the same axis.
A tap on one lists the biblical events that fall inside its years.

Two chronologies sit on the strip, and the app names both wherever it shows a
date. The biblical events are Theographic's, which follow Floyd Nolen Jones,
in the tradition of Ussher (creation 4004 BC, Exodus 1491 BC). The world
history is Wikidata's conventional scholarly dating (the Kingdom of Israel
930–720 BC, where Jones puts the division of the kingdom in 975 BC). They can
disagree, and the strip shows where.

The map: the Map button on the strip puts a map of the biblical world on the
table as a card, from Italy to Persia. Every place with coordinates is a dot
(1,257 of them). The places that the cards on the table name are labelled,
with a dashed line to each card that names them. A place's entry in the
search panel has a Show on the map button, and a tap on a place on the map
shows it. Pinch the map card to zoom in; its lines stay one pixel wide. The
coastlines are modern; ancient ones differed in places, such as the head of
the Persian Gulf.

Two translations: each passage card has KJV, BSB and Both buttons. Both puts
the Berean Standard Bible beside the KJV, verse by verse, and marks the 16
verses the BSB leaves out of its main text, such as Matthew 17:21. Highlights,
links and word studies work on the KJV words; the BSB is plain text for now.

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
| `app/lib/` | Modules with no DOM dependency where possible: `affine.js`, `gesture.js`, `reference.js`, `words.js`, `links.js`, `timeline.js`, `map.js`, `workspace.js`, `pointer-log.js`. |
| `app/data/bible.js` | The server's access to the text: passages by reference, and search. |
| `app/data/kjv/` | The KJV, one JSON file per book, made by the import. |
| `tools/` | The imports: `import-kjv.js` and its parser, `import-xrefs.js`, `import-strongs.js`, `import-theographic.js`, `import-bsb.js`, `import-world.js` and `import-map.js`. |
| `app/data/strongs/` | The Strong's numbers, one JSON file per book, and the dictionary. |
| `app/data/entities/` | People, places, groups, events, the verses that name them, and Easton's dictionary. |
| `app/data/bsb/` | The Berean Standard Bible, one JSON file per book, for the parallel view. |
| `app/data/world/` | The world-history track: polities and periods from Wikidata. |
| `app/data/map/` | The base map, from Natural Earth. |
| `app/data/xrefs/` | The cross-references, one JSON file per book, made by the import. |
| `docs/touch-setup.md` | How to connect the touch panel through a Linux VM in UTM. |

## Colors

A wireframe for now: black boxes with thin gray lines, white text, and red only
for the words of Christ. No rounded corners, shadows, fills or texture. Each
text color is checked with APCA on black: white Lc 108, gray Lc 76, red Lc 76.
`app/styles/global.css` lists the values and the rule for changing them.

## The world-history data

`app/data/world/polities.json` lists the polities and periods on the
timeline's world track, each with its Wikidata item, region and dates. The
list itself is in `tools/import-world.js`; the script asks Wikidata for the
dates:

```sh
node tools/import-world.js
```

It uses each item's start and end time (P580, P582), else its inception and
dissolution (P571, P576), in astronomical years. Wikidata is CC0. The script
makes network requests to query.wikidata.org.

## The map data

`app/data/map/near-east.json` is the base map: land, natural lakes and rivers
as SVG paths, from Natural Earth's 1:10 million files (public domain), clipped
to the region and simplified to 91 KB. `app/lib/map.js` holds the projection
that both the import and the server use.

```sh
node tools/import-map.js <directory with ne_10m_land, ne_10m_lakes and ne_10m_rivers_lake_centerlines .geojson>
```

Modern reservoirs, such as Lake Nasser, are left out. The place markers come
from the entity data at request time.

## The BSB data

`app/data/bsb/<BOOK>.json` holds the Berean Standard Bible (public domain) by
the KJV data's verse addresses: `{ "JHN.3.16": [{ "style": "p", "text": "For God so loved ..." }] }`.

```sh
node tools/import-bsb.js <usfm directory from eBible.org's engbsb_usfm.zip>
```

Footnotes, section headings and Strong's tags are left out. A psalm title
joins verse 1, as in the KJV data. 31,086 verses; the 16 KJV verses with no
BSB text have no entry.

## The entity data

`app/data/entities/` comes from
[Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata)
(CC BY-SA 4.0):

| File | What it holds |
| --- | --- |
| `entities.json` | 3,067 people, 1,298 places, 23 groups and 450 events, by id (`person:david_994`) |
| `verses/<BOOK>.json` | The entities each verse names (24,556 verses name at least one) |
| `timeline.json` | The events in time order, for the strip |
| `easton.json` | Easton's Bible Dictionary (1897), 3,962 terms |

```sh
node tools/import-theographic.js <directory with Theographic's json files>
```

It needs `verses`, `people`, `places`, `peopleGroups`, `events` and `easton`
from Theographic's `json/` folder. The license is CC BY-SA, like the Strong's
dictionary: the app credits Theographic wherever it shows an entity, and the
data must keep the license if it is published as data.

Peoples such as the Hittites and the Amorites are not linked entities in
Theographic. They are found through Easton's dictionary, by the word.

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
{ "n": 1, "id": "PSA.3.1", "blocks": [
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
  title, `b` a stanza break, `s1` a Psalm 119 letter heading.
- `marks` are the character styles: `add` supplied words (italics), `nd` the
  divine name, `wj` the words of Jesus, `tl` a transliterated letter.
- `books.json` lists the books with the verse count of each chapter.

The source is eBible.org's
[`eng-kjv2006_usfm.zip`](https://eBible.org/Scriptures/eng-kjv2006_usfm.zip),
which is in the public domain (except for the Crown patent on printing in the
UK). To make the files again:

```sh
npm run import:kjv -- <usfm directory>
```

`tools/lib/usfm.js` reads the USFM. Footnotes, Strong's tags and the closing
headings of the epistles are left out; psalm titles and Psalm 119 headings
join their verse.

The data came from an API.Bible export until 2026-11-07. The rebuilt text
matches it in 31,086 of 31,102 verses. The 16 differences are edition
differences in the eBible text: "can not", "what soever", "where unto" and
"where in" for "cannot", "whatsoever", "whereunto" and "wherein" in 13
verses; brackets for parentheses in 1 John 2:23; and two verses where the old
data had a stray space. The old data's `org` field (the original-language
verse numbers, from API.Bible) is not in the rebuilt data.

The rebuild also renumbers the words of those verses. A highlight made before
the rebuild on one of the 16 verses can be off by a word.
