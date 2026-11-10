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
every card that holds those words shows it. A highlight has one of three
styles: inverse, a double underline, or a box. The three buttons in the menu
at the top right pick the style of the next one. Marking the same span again
in the same style, or a tap on a highlighted word while you hold the card,
removes it. Marking it in another style changes its style.

Links: while you mark words, drag the marking finger out of the card and lift
it on another card. That links the marked words to the highlight under your
finger, or to the whole passage when no highlight is there. A solid white line
shows a link; a dashed gray line joins the places where the same highlighted
words show on more than one card. Drawing a link again removes it, and
removing a highlight removes its links. A link is two spans of word
addresses, kept with the workspace. A label at the middle of each link says
what it is: a tap changes it from "link" to "quotes", "fulfills" and
"contrasts", and back. A link with a type has an arrow, from the words you
marked to the words you dropped them on.

Phrases and notes: lift the marking finger on the empty table, and the marked
words become a card of their own, a phrase card. Note, in the menu, puts a
note card on the table and opens the note editor with the on-screen
keyboard; a tap on a note opens it again. Lift the marking finger on a note,
and the note quotes the words. A quote is the text itself, by address: its
words keep their addresses, so a dashed line joins the quote to the
highlight it came from. A verse that a note quotes has a gray line down its
left side on the other cards.

Passage cards step through the text: ‹ and ›, beside the heading, go to the passage before
or after, the same size. Sync joins cards: when one synced card steps, the
others go to the same passage, each in its own translation, for example the
KJV and the BSB of one chapter. Copy puts the words of the card and their
reference on the clipboard. A reference can cross a chapter, such as
`Gen 1:1-2:3`.

Workspaces and undo: Undo and Redo in the menu (or Command-Z and
Shift-Command-Z) step through every change to the table but a pan. The
workspace button opens a sheet: save the table under a name, open or delete
a saved table, start a new table, save the table to a JSON file, or open a
file. Opening a table, or a new one, is one step that Undo takes back.

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
shows it. The coastlines are modern; ancient ones differed in places, such
as the head of the Persian Gulf.

The map zooms inside its frame, and the card stays where it is (the heading
and the credit still move the card):

| Inside the frame | Does |
| --- | --- |
| one finger, or a mouse drag | moves the map |
| two fingers | zoom about their middle, up to 16 times |
| the wheel, or two fingers on a trackpad | moves the map |
| a pinch on the trackpad, or Control and the wheel | zooms about the pointer |
| +, − and Whole map, in the corner | zoom about the middle, or show all of it |
| the arrow keys, + and −, and 0, with the focus on the frame | the same |

At the whole map, only the most named places have names (about 40). Each
closer level (2, 4, 8 and 16 times) names more, as far as there is room, so
names never cover each other. The places that a card names, and the one on
show, always have their names. The dots, names and lines keep their size at
every zoom, and a scale bar gives the distance. Show on the map zooms to fit
the places. The workspace keeps the view; Undo leaves it, as it leaves the
pan of the table.

Two translations: each passage card has KJV, BSB and Both buttons. Both puts
the Berean Standard Bible beside the KJV, verse by verse, and marks the 16
verses the BSB leaves out of its main text, such as Matthew 17:21. Highlights,
links and word studies work on the KJV words; the BSB is plain text for now.

Cards zoom semantically: below about half size, a card shows its short form
(heading, opening words, verse count), and a passage longer than 24 verses
arrives in that form. The search panel collapses to one box: "Hide" and
Escape close it, "Search" and "/" open it.

Mouse, trackpad and keyboard: everything the hands do has another way.

| To | Touch | Mouse or trackpad | Keyboard |
| --- | --- | --- | --- |
| Pan the table | Drag the empty table | Drag the empty table, or scroll | Arrow keys (Shift: further) |
| Move a card | Drag it | Drag it | Tab to it, then the arrow keys |
| Scale a card | Pinch it | Pinch on the trackpad, or Control + wheel | `+` and `-` |
| Turn a card | Turn two fingers on it | Turn two fingers on the trackpad (Safari) | `[` and `]` |
| Mark words | Hold the card, run a finger over them | Option + drag over them | — |
| Remove a card | × | × | Delete |
| Undo, Redo | Undo, Redo | Undo, Redo | Command-Z, Shift-Command-Z |

Marking with the keyboard alone is not there yet.

Snapping: a card that a hand or a mouse holds snaps upright when it is within
5° of upright (or of a quarter turn), and to full size within 4%. An upright
card lines up with the edges and middles of the other upright cards, or sits
one gap (1rem) beside them, within 12 px, and dotted guides show where.
Snap in the menu turns it off and on. With a mouse, hold Command or Control
while you drag to move freely. The wheel and the keys do not snap.

Study tools:

- **The passage guide.** Tap a passage's heading (or press Enter on a card
  that has the focus). The search panel shows what the data has on it: its
  parallel passages, its cross-references (joined over all its verses, most
  voted first), the people, places and groups it names, its events with
  their dates, and the notes on the table that quote it. "Put them beside
  the card" lays the parallels out in a row to the right of the card, at
  its size. "Show its places on the map" marks them all on the map.
- **Parallel passages** are runs of cross-references: verse after verse of
  one passage refers to verse after verse of another, in the same order.
  That finds Kings and Chronicles, the Synoptic Gospels, 2 Samuel 22 and
  Psalm 18, and Isaiah 36–39 and 2 Kings 18–20 (1,241 pairs). A quotation of
  one verse is not a run, so the Old Testament in the New is not found this
  way.
- **Marks** mark words on every card by what they are, live, so a card put
  down later shows them too. In a word study or on a person, place or group,
  "Mark it on every card" marks every word that renders that Strong's number
  or names that entity. Marks, in the menu, offers the words of Christ, the
  words the translators supplied, the divine name, and every person, place
  or group, and lists the marks that are on. Each mark takes a shape of its
  own (a bar over, dots under, a dashed box, a wavy line), and the marks are
  kept with the table.
- **Compare.** On a card in Both, Compare sets in bold the words that one
  translation has and the other does not. Words are compared in a plain form:
  "thee" is "you", and "believeth" is "believes".
- **Word statistics.** A word study counts how the KJV renders the word
  ("mercy" 137, "kindness" 39, …) and shows where it occurs, one bar per
  book.
- **The landscape.** "Where, chapter by chapter" in a word study, on a person
  or place, or under a text search, puts a card with one cell per chapter of
  the Bible, marked larger where the subject occurs more. A tap on a chapter
  puts the chapter beside it. Books, on the timeline strip, compares the 66
  books: each a bar as long as its verses, cut into chapters, with its group
  and the author tradition gives it.

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
| `app/elements/` | Custom elements: `bible-table`, `passage-search`, `gesture-card`, `map-view`, `reading-settings`, `contrast-chart`, `kjv-verse`, `time-line`, `table-menu`, `note-editor`, `touch-keys`, and for the touch test `touch-probe` and `calibration-target`. |
| `app/lib/` | Modules with no DOM dependency where possible: `affine.js`, `gesture.js`, `palm.js`, `reference.js`, `words.js`, `links.js`, `timeline.js`, `map.js`, `workspace.js`, `history.js`, `snap.js`, `rules.js`, `compare.js`, `apca.js`, `pointer-log.js`. |
| `app/data/bible.js` | The server's access to the text: passages by reference, search, and word statistics. |
| `app/data/study.js` | The passage guide, the parallel passages and the landscape. |
| `app/data/canon.js` | The books by group, and the traditional author of each. |
| `app/data/parallels.json` | The parallel passages, made from the cross-references by `tools/import-parallels.js`. |
| `app/data/kjv/` | The KJV, one JSON file per book, made by the import. |
| `tools/` | The imports: `import-kjv.js` and its parser, `import-xrefs.js`, `import-parallels.js`, `import-strongs.js`, `import-theographic.js`, `import-bsb.js`, `import-world.js`, `import-map.js`, `import-coast.js` and `import-relief.js`. |
| `app/data/strongs/` | The Strong's numbers, one JSON file per book, and the dictionary. |
| `app/data/entities/` | People, places, groups, events, the verses that name them, and Easton's dictionary. |
| `app/data/bsb/` | The Berean Standard Bible, one JSON file per book, for the parallel view. |
| `app/data/world/` | The world-history track: polities and periods from Wikidata. |
| `app/data/map/` | The base map: coast and lakes from GSHHG, rivers from Natural Earth, relief from ETOPO 2022. |
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

## Exploring

- **Did you know?** The ✦ at the start of the search panel's trail shows a
  fact worked out from the data (`app/data/facts.js`): the shortest verse,
  Methuselah's years, how the KJV renders *chesed*, the Aramaic of Daniel,
  the length of Paul's journeys. "Show me" opens what it is about; "Another"
  goes through them all. A panel with nothing on it opens on one.
- **Often named with:** an entry for a person, place or group lists the
  others named most often in the same verses, scored so that a name found
  everywhere (God) gives way to the ones that belong to it (Barnabas, for
  Paul).
- **Journeys on the map:** Paul's three journeys and his voyage to Rome
  (`app/data/journeys.js`), written by hand from Acts, each stop with the
  verse that names it. Paul's entry, and the guide of a passage of Acts that
  a journey covers, list them; a tap draws the route on the map: ochre,
  solid by land, dashed by sea, with an arrow on each leg. The dates are
  Theographic's events, by Jones's chronology, as the timeline shows them.
  Where Acts names only a region (Macedonia), the usual city is used and
  marked as a reading. Places with no coordinates, or passed by at sea, are
  left out, and a test checks every stop against its verse.

## The original languages

A passage card has two more versions beside KJV, BSB and Both:

- **Original:** the Hebrew (with the Aramaic of Daniel and Ezra), right to
  left, or the Greek, as running text.
- **Word by word:** each word of the original over its transliteration, its
  English, its grammar in words and its Strong's number.

A tap on a Hebrew or Greek word studies its Strong's number, and the KJV
words on every card that render it are underlined: that is how the original
and the KJV line up. The Hebrew is the Leningrad text with the Qere; the
Greek is the Textus Receptus, the text the KJV translated, and a word the
Nestle-Aland text does not have has a dotted ochre line. Verses are numbered
as the KJV numbers them.

The data is STEPBible's Translators Amalgamated Hebrew OT and Greek NT, with
its grammar code lists (CC BY 4.0, from Tyndale House, Cambridge), built
into `app/data/original` by:

```sh
node tools/import-original.js <directory with the TAHOT, TAGNT, TEHMC and TEGMC files>
```

The files are in https://github.com/STEPBible/STEPBible-Data ("Translators
Amalgamated OT+NT" and "Morphology codes"). The fonts are Ezra SIL for
Hebrew and Gentium Plus for Greek (SIL Open Font License), in
`app/public/fonts`.

## The research trail

The search panel keeps a trail of what you looked at (`app/lib/trail.js`):
a row of chips under the field, each with the pictogram of its kind, and ‹
and › to step back and forward (Alt and the arrow keys too). A tap on a chip
goes back to that view, and the table's marks, the map and the timeline
follow, as they did the first time. "…" shows the whole trail.

A new view goes after the one on show, as a browser's page does. A search
being typed is one step, not one per letter. Opening something that is
already in the trail goes to its chip and adds nothing. The trail is kept
with the workspace, so a saved table has its own path; it is not a step for
Undo.

## The reading room (the design system)

Every page is in the reading room: warm paper cards on a linen desk,
Literata for the text, Atkinson Hyperlegible Next for the interface, and a
colored tab on each card for its kind. `app/styles/reading-room.css` holds
its tokens, on `:root`; the older names the table's parts use (`--text`,
`--muted`, `--line`) point to them (`app/styles/global.css`). `/design` shows
the whole system with real content, and its settings beside the page.

The KJV runs in paragraphs: a verse that starts with the KJV's ¶ starts a
new one, and the mark itself is not shown. A chapter opens with an initial in
lapis. A highlight is a wash under the words.

The Reading button in the table's menu opens the reader's settings
(`reading-settings`), as `/design` does. They are tiles that show what they
do: each theme and paper in its own colors, five letters for the text sizes,
drawn lines for the spacing and the layout, and a sample of each thing the
text shows. A tap outside a sheet of the menu, or outside the note editor,
closes it (a resting palm does not), and so does Escape. The settings are: Day, Night, or as
the computer is,
Bright, Soft or Lamp paper for a dim room, five text sizes, line spacing,
and red letters, verse numbers, initials and paragraphs on or off. The
browser keeps them.

The colors are manuscript pigments, and each kind of thing has one: ochre
for people, verdigris for places, slate for groups, purple for events and
eras, lapis for passages and links. Vermilion is for the words of Christ
alone. `test/design.test.js` checks every color with APCA (`app/lib/apca.js`)
on the paper of all six settings.

The fonts are in `app/public/fonts`, Latin and extended Latin only, each with
its SIL Open Font License: Literata for the text and Atkinson Hyperlegible
Next for the interface. They came from Fontsource on npm (version 5.3). The pictograms are in
`app/icons/kinds`.

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


The coast and lakes are GSHHG's (full resolution, LGPL; the notice is in
`app/data/map/GSHHG-LICENSE.txt`), at two levels of detail: simplified to
about 2 km for the whole map, and to about 150 m for a close view. Natural
Earth still gives the rivers, and its list of natural lakes decides which of
GSHHG's lakes stay (a reservoir such as Lake Nasser does not). Run the Natural
Earth import first, then the coast:

```sh
node tools/import-map.js <Natural Earth GeoJSON directory>
node tools/import-coast.js <directory with GSHHS_f_L1.shp and GSHHS_f_L2.shp>
```

The map card is in the reading room's style. It draws the close coast from
a zoom of 3, and the Levant always has its sharper relief. While the map
moves, the frame moves a picture of it and draws it again when it stops,
so a pinch stays at the screen's frame rate.

The relief: `app/data/map/relief.json` holds, for each
of six heights (200, 500, 1,000, 1,500, 2,000 and 3,000 m), the land at or
above it as one path; its edge is the contour line. `app/public/map/` holds
two hill shades, lit from the northwest: one of the whole map, and a sharper
one of the Levant for a close view, which also has its own contours. Both
come from NOAA's ETOPO 2022 (free to use and share), through NOAA's ERDDAP
service, and need nothing but Node to build:

```sh
curl -o etopo-30s.nc 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.nc?z%5B(18):2:(46)%5D%5B(8):2:(62)%5D'
curl -o etopo-15s-levant.nc 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.nc?z%5B(29.2):1:(34.6)%5D%5B(33.4):1:(37.8)%5D'
node tools/import-relief.js etopo-30s.nc --levant etopo-15s-levant.nc
```

The first file is 87 MB and the second 5.5 MB; the outputs are 1.9 MB of
paths and 2.3 MB of images.
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

## The parallel passages

`app/data/parallels.json` lists the parallel passages as
`[a, b, references]`, with `a` before `b` in canon order:
`["2SA.22.1-21", "PSA.18.1-20", 19]`. They come from the cross-references
in `app/data/xrefs`, so the script downloads nothing:

```sh
node tools/import-parallels.js
```

A run of at least three references, each a step forward on both sides,
that covers at least three verses on each side, is a parallel. Runs between
the same two passages join, and two passages of one book must be at least
ten verses apart. The rules and their limits are at the top of the script.

