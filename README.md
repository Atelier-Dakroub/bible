# bible

A multi-touch research surface for the Bible. The text goes on a table as
cards that you move, turn, scale, highlight and connect. The app is built
with [transclude](https://transclude.dev).

## Quick start

You need Node 22.9 or later (`.nvmrc`).

```sh
npm install
npm run dev      # then open http://localhost:1960/table
```

The texts, dictionaries, maps and pictures are in the repository, so nothing
else needs to be downloaded or imported. The app reads aloud in the device's
own voice; to add recordings of your own, made with AI or in your own voice,
see [docs/recordings.md](docs/recordings.md). `.env.example` lists the
optional settings.

`npm run verify` runs the tests, the CRAP check, the types and a build; see
CONTRIBUTING.md.

The guide for the reader is at `/guide` in the app (Tools has a link). Its
pages are Markdown, in `app/routes/guide/`: Transclude serves each as a page,
through the converter in `app/lib/markdown.js`.

## Licenses

The code is under the MIT License (LICENSE). The data comes from many
sources under their own licenses, public domain, CC0, CC BY, CC BY-SA, ODbL
and LGPL among them: DATA-LICENSES.md gives the license of each file, and
the app's Credits page (`/credits`) gives each source with its creator and a
link. The libraries in the browser build are in THIRD-PARTY-NOTICES.md.

## The app

`/table` is the table: search the text, then tap a result or drag it out
sideways to put the passage on the table as a card. Cards move, turn and
scale; a drag on the empty table pans everything, and the table has no edge.
What is on the table is kept in the browser as addresses and positions.

The tools are on one rail (`app/elements/table-rail.html`), on the left at
first: Search, Timeline, Map, Books, Overview, Note, Undo, Redo, Tools and
Hide. Search, Timeline and Tools open and close their panels beside the rail;
Map and Books put their cards on the table or take them away, and are lapis
while the card is there; Overview shows the whole table, small, each card as it is with a label of
its title, spread apart so that none overlaps, and a tap on a card or a place goes there at full size
(`app/lib/overview.js`; also O, or a pinch in on the empty table); Hide clears
the screen of the rail and the panels, and leaves one Show button. The rail goes on any edge: drag its grip (⋮⋮) to an edge, tap
the grip for the next edge, or choose in Tools, Table. A panel's grip drags
it off the rail to float anywhere, and back onto the rail to dock; its float
button does the same without a drag. Tools, Table also sets the size of the
rail and the panels (Small, Medium, Large), apart from the size of the text.
Each screen keeps its own choices (`app/lib/chrome.js`). On a phone the rail
is along the bottom, icons only, and one panel opens at a time, the width of
the screen.

The app's own on-screen keyboard (`touch-keys`) is for a touch screen with
no keyboard of its own, such as the kiosk panel (`app/lib/keyboard.js`). It
shows when a finger touches a field, but not on a phone or a tablet, which
have their own, and not once a real key has been pressed on the visit. Its
Hide key, Escape, or a tap away from the field hides it; the note stays open.
Tools, Table chooses Automatic, Always or Never.

Reading aloud: the device's own voice reads. A copy that runs under Node can
also play recordings of the KJV and the BSB, made with AI (`tools/voice`,
Qwen3-TTS) or in your own voice (`tools/join-verses.js`); they are off unless
`BIBLE_AUDIO` names their folder (`docs/recordings.md`). Then Tools, Reading,
Read aloud (Voice) chooses Recording or This device (`GET /listen` lists the
voices), and the device's voice reads whatever has no recording. The
recordings a passage has are listed on
its card, so a tap starts one at once.

The speaker on a passage card is a mode. Pressed (lapis), the
card reads aloud, verse by verse, marking the verse being read, and a tap on
a verse plays from it; a tap on the verse being read pauses (the button
shows the speaker again, still pressed), and a tap on any verse plays from
there. Pressed again, the mode ends: the reading stops, and taps on the card
do what they always do (a word's study, a verse's references). The card keeps
its place, and the next time it goes on from that verse ("Listen from verse
1:4"); a reading that ends leaves the mode and begins again next time. One
card is in the mode at a time. Tools, Reading, Read aloud (Speed) sets the
reading speed (0.8×, 1×, 1.15×, 1.3×, 1.5×) for the recording, at the same
pitch, and for the device's voice; each device keeps its own. A recording
plays from the card's first verse to its last (`app/data/audio.js`,
`/listen/<address>` for the times, `/audio/<voice>/<version>/GEN.1.m4a` for
the chapters).
Where there is no recording, and for the other versions, the device's own
voice reads (`app/lib/speech.js`), in the reader's own accent where the
device has a voice for it (the browser's languages: en-GB, en-AU; British
where they name no country), or the voice chosen in Tools (This device's
voice, kept as `bible.voice.<lang>`): the KJV or the BSB in English, the Hebrew or the Greek in Original, Word by word and Syntax,
in their modern pronunciations. The verse being read is marked, and the word
too where the voice says which. A second press stops it. On Word by word, each
transliteration shows its syllables with the stressed one in bold
(`app/lib/syllables.js`: STEPBible marks the Hebrew; the Greek is worked out
from its accent), and a tap on it says the word. A word study has a speaker
by its lemma, and Strong's pronunciation. A device without a Hebrew or Greek
voice says so. A Mac and an iPhone have good ones (Carmit, Melina).

The search panel grows with use: at rest it is only its field; an answer
shows the trail and the results under it, and a tap on the empty table, or
Escape, folds them away again (a tap on the field brings them back). The
timeline is one compact row of eras with the events' ticks; World shows the
world-history lanes under it, and ⓘ the note on whose dates these are.

Highlights take two hands: hold a card still with one finger, then run a
finger of the other hand over the words. A highlight is stored as a span of
word addresses (`JHN.3.16.w2` to `JHN.3.16.w6`), apart from the text, so
every card that holds those words shows it. A highlight has one of three
styles: Filled, Underlined (a double line) or Boxed. Style, in Tools, Marks,
New highlights, picks the style of the next one. Marking the same span again
in the same style, or a tap on a highlighted word while you hold the card,
removes it. Marking it in another style changes its style.

Links: while you mark words, drag the marking finger out of the card and lift
it on another card. That links the marked words to the highlight under your
finger, or to the whole card when no highlight is there. The link button at
the top of every card links whole cards: drag it onto another card, or tap it
for a list of the cards on the table (the way for the keyboard, and for a
card off the screen). Any card can be an end: a passage, a note, a person,
the map. A whole-card end is the card's address, so a link to a passage shows
on every card of it in any translation; a phrase card's end is its words.
When the last card of an address leaves the table, its whole-card links go
too, and Undo brings them back. Linked cards move as a group: Shift and a
drag (a mouse or a pen), or one finger held still for half a second and then
dragged, moves the card and every card linked to it step by step
(`cluster` in `app/lib/links.js`), with a ring round each as it lifts. The
group moves only, never snaps, and is one step for Undo. A solid white line
shows a link; a dashed gray line joins the places where the same highlighted
words show on more than one card. Drawing a link again removes it, and
removing a highlight removes its links. A link's two ends are each a span of
word addresses or a card's address, kept with the workspace. A label beside each link says
what it is: a tap changes it from "link" to "quotes", "fulfills" and
"contrasts", and back. A link with a type has an arrow, from where the link
started to where it was dropped. No line covers the text: every line between
cards (links, the same words, cross-references, and the lines to the map and
the timeline) is a curve from each card's edge, at the height of the words it
joins, drawn under the cards (`app/lib/link-lines.js`). A dot marks where it
leaves a card, and a bar in the margin a link's words. The lines to the map
and the timeline show again over the map and the strip, where they end. A
label stands beside a port or along the curve where no card or panel is; with no room,
it shows while one of its cards is the one touched last.

Phrases and notes: lift the marking finger on the empty table, and the marked
words become a card of their own, a phrase card. Note, on the rail, puts a
note card on the table, and you write on the card itself; a tap on a note's
text writes in it again, and a tap off the note or Escape stops the writing
(`app/lib/note-editing.js`). A note has a title, a kind (Observation,
Question, Interpretation, Application, Prayer), formatting, and references
typed or found with @; the guide's Notes page (`/guide/notes`) tells all of it. Lift the
marking finger on a note, and the note quotes the words. A quote is the text itself, by address: its
words keep their addresses, so a dashed line joins the quote to the
highlight it came from. A verse that a note quotes has a gray line down its
left side on the other cards.

Passage cards step through the text: ‹ and ›, beside the heading, go to the passage before
or after, the same size. Sync joins cards: when one synced card steps, the
others go to the same passage, each in its own translation, for example the
KJV and the BSB of one chapter. Copy puts the words of the card and their
reference on the clipboard. A reference can cross a chapter, such as
`Gen 1:1-2:3`.

Workspaces and undo: Undo and Redo on the rail (or Command-Z and
Shift-Command-Z; Control on other computers) step through every change to
the table but a pan. Tools, Saved saves the table under a name, opens or
deletes a saved table, saves the table to a JSON file or its notes to a
Markdown file, opens a file, or starts a new table. Opening a table, or a
new one, is one step that Undo takes back.

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
Easton's dictionary text (a long entry is cut after a few sentences, and
Read more shows the rest, on its card too), and the verses that name it. Its relations are
buttons, and its heading pulls out as a card. A people's name with no linked
entity, such as "Hittite", shows its entry in Easton's dictionary. The
timeline shows 450 events on an axis of equal-width eras;
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

The map: the Map button on the rail puts a map of the biblical world on the
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

The mountains that Theographic gives as places (Sinai, Hermon, Carmel, Nebo
and about 40 more) have a peak, not a dot. The ranges have their names, as an
atlas sets them, in spaced italic capitals along the range
(`app/data/map/ranges.js`, placed by hand): the great ranges (Taurus, Zagros)
from the whole map, Lebanon and Sinai a little closer, and the Bible's hill
countries (Mount Ephraim, the Mountain of Judah, Mount Gilead), in the KJV's
words and with the verse that names each, only at the closest zoom, where
there is room among the places.

The seas, gulfs and great lakes have their names on the water, in spaced
italic capitals in lapis (`app/data/map/waters.js`, placed by hand). Where the
Bible gives the water a name of its own, that name is under the modern one,
in the KJV's words: the Mediterranean is "the Great Sea", the Dead Sea "the
Salt Sea", the Gulf of Suez "the Egyptian Sea", the Ionian Sea "Adria". A
large sea is named from the whole map, and a small lake or a narrow gulf only
close in, where it has room. A tap on a name shows the place in the panel.
The dots that Theographic gives these waters show only while a card names
them or the panel shows them. The map has no ocean: of the Indian Ocean, only
the Arabian Sea is inside its frame.

Two translations: each passage card has KJV, BSB and Both buttons. Both puts
the Berean Standard Bible beside the KJV, verse by verse, and marks the 16
verses the BSB leaves out of its main text, such as Matthew 17:21. Highlights,
links, quotes in notes and cards of words work on the words of both (a BSB
word is addressed apart, as `JHN.3.16.b3`); word studies read the KJV.

Cards zoom semantically: below about half size, a card shows its short form
(heading, opening words, verse count), and a passage longer than 24 verses
arrives in that form. Search on the rail, or "/", opens the search panel;
its × closes it.

Mouse, trackpad and keyboard: everything the hands do has another way.

| To | Touch | Mouse or trackpad | Keyboard |
| --- | --- | --- | --- |
| Pan the table | Drag the empty table | Drag the empty table, or scroll | Arrow keys (Shift: further) |
| See the whole table (the overview) | Overview, or pinch in on the empty table | Overview, or pinch in over the empty table | O |
| Move a card | Drag it | Drag it | Tab to it, then the arrow keys |
| Scale a card | Pinch it | Pinch on the trackpad, or Control (or Command) + wheel | `+` and `-` |
| Turn a card | Turn two fingers on it | Turn two fingers on the trackpad (Safari) | `[` and `]` |
| Mark words | Hold the card, run a finger over them | Option + drag over them | — |
| Remove a card | × | × | Delete or Backspace |
| Undo, Redo | Undo, Redo | Undo, Redo | Command-Z, Shift-Command-Z (Control on other computers) |

The guide's Keys and touch page (`/guide/keys-touch`) lists every key.

Marking with the keyboard alone is not there yet.

Snapping: a card that a hand or a mouse holds snaps upright when it is within
5° of upright (or of a quarter turn), and to full size within 4%. An upright
card lines up with the edges and middles of the other upright cards, or sits
one gap (1rem) beside them, within 12 px, and dotted guides show where.
Snap, in Tools, Table, turns it off and on. With a mouse, hold Command or Control
while you drag to move freely. The wheel and the keys do not snap.

Study tools:

- **The passage guide.** Tap a passage's heading (or press Enter on a card
  that has the focus). The search panel shows what the data has on it: its
  parallel passages, its cross-references (joined over all its verses, most
  voted first), the people, places and groups it names, its events with
  their dates, and the notes on the table that quote it. "Put them beside
  the card" lays the parallels out in a row to the right of the card, at
  its size. "Show its places on the map" marks them all on the map.
- **Start a study**, at the top of the guide, lays the passage out as a
  study, from the guide's own data (`studyPlan` in `app/data/study.js`,
  `/study/:address`, `app/lib/study.js`): the Old Testament it quotes on its
  left (or the New Testament passages that quote it on its right), a study
  note with headings, the people it names, its parallels, the five
  cross-references with the most votes, and the map with its places. Each
  verse comes once, and God and Jesus get no card. The columns go to the
  right of the cards on the table, at the scale that fits the screen across
  (not below 0.6), every card linked to the passage, as one step for Undo.
  The same button on a word study lays out the word's landscape and a verse
  for each sense (then for each book that uses it most), and marks the word
  on every card; on a topic of Nave's, a passage for each part of the topic
  around the note; on a person, their family, the chapters that name them
  most, and their first journey (or birth and death places) on the map; on
  a place, the first events there or the people born or who died there, the
  chapters that name it most, and the place on the map; on an event, its
  people, the passages that tell it in canon order, and its places on the
  map, with its date and what it is part of in the note; on a group, its
  members named most (ten at most) and the chapters that name it. An entity
  that nothing names and with no members has no study (`studied` in
  `entityView`). One plan shape serves all seven (`planOf` in
  `app/lib/study.js`).
- **Parallel passages** are runs of cross-references: verse after verse of
  one passage refers to verse after verse of another, in the same order.
  That finds Kings and Chronicles, the Synoptic Gospels, 2 Samuel 22 and
  Psalm 18, and Isaiah 36–39 and 2 Kings 18–20 (1,241 pairs). A quotation of
  one verse is not a run, so the Old Testament in the New is not found this
  way.
- **Marks** mark words on every card by what they are, live, so a card put
  down later shows them too. In a word study or on a person, place or group,
  "Mark it on every card" marks every word that renders that Strong's number
  or names that entity. Tools, Marks offers the words of Christ, the
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
  puts the chapter beside it. Books, on the rail, compares the 66
  books: each a bar as long as its verses, cut into chapters, with its group
  and the author tradition gives it.

`/touch` is the touch test page for the panel.

```sh
npm install
npm run dev      # http://localhost:1960
npm test         # every test in test/
npm run check    # types
npm run verify   # the tests (with the CRAP check), the types and a build: the build compiles every template
```

## Layout

| Path | What it holds |
| --- | --- |
| `app/routes/` | Pages. `table.html` is the table, `search.html` the search and its `results` fragment, `card/[address].html` one card as a fragment, `guide/` the guide's Markdown pages, `credits.html` the sources, `design.html` the design system, `touch.html` the touch test. |
| `app/elements/` | Custom elements: `bible-table`, `passage-search`, `gesture-card`, `map-view`, `reading-settings`, `contrast-chart`, `kjv-verse`, `table-rail`, `time-line`, `table-menu`, `note-editor` (the dock of the on-screen keyboard while a note is written), `touch-keys`, `video-player`, `svg-icon`, and for the touch test `touch-probe` and `calibration-target`. |
| `app/lib/` | Modules with no DOM dependency where possible: `affine.js`, `apca.js`, `chrome.js`, `citations.js`, `compare.js`, `gesture.js`, `grammar.js`, `history.js`, `keyboard.js`, `lemma.js`, `links.js`, `link-lines.js`, `map.js`, `markdown.js`, `motion.js`, the notes' `note-*.js`, `palm.js`, `pointer-log.js`, `reference.js`, `rules.js`, `screen.js`, `snap.js`, `spatial.js`, `speech.js`, `study.js`, `syllables.js`, `timeline.js`, `trail.js`, `words.js`, `workspace.js`. |
| `app/data/bible.js` | The server's access to the text: passages by reference, search, and word statistics. |
| `app/data/load.js` | Reads a data file when a request needs it: from `app/data` under Node, and through the edge (`dist/edge/data`, linked by `tools/edge-data.js` in `npm run build`) on Cloudflare. The data is not built into the server code. |
| `app/data/study.js` | The passage guide, the parallel passages and the landscape. |
| `app/data/canon.js` | The books by group, and the traditional author of each. |
| `app/data/parallels.json` | The parallel passages, made from the cross-references by `tools/import-parallels.js`. |
| `app/data/kjv/` | The KJV, one JSON file per book, made by the import. |
| `tools/` | The imports: `import-kjv.js` and its parser, `import-xrefs.js`, `import-parallels.js`, `import-strongs.js`, `import-theographic.js`, `import-bsb.js`, `import-world.js`, `import-kings.js`, `import-map.js`, `import-coast.js`, `import-rivers.js`, `import-relief.js`, `import-ancient.js`, `import-original.js`, `import-syntax.js`, `import-senses.js`, `import-topics.js`, `import-quotations.js`, `import-images.js` and `import-videos.js`. Also the MCP server (`mcp-server.js`), the CRAP check (`crap.js`), the notices (`notices.js`), the AI voice (`voice/`) and the joining of recordings made a verse to a file (`join-verses.js`). |
| `app/data/audio/` | The time each verse begins in each recording that `tools/voice/generate.py` makes. |
| `app/data/videos.json` | The videos and the passages each one shows. |
| `app/data/strongs/` | The Strong's numbers, one JSON file per book, and the dictionary. |
| `app/data/entities/` | People, places, groups, events, the verses that name them, and Easton's dictionary. |
| `app/data/bsb/` | The Berean Standard Bible, one JSON file per book, for the parallel view. |
| `app/data/world/` | The world-history track: polities and periods from Wikidata. |
| `app/data/map/` | The base map: coast and lakes from GSHHG, rivers from Natural Earth (closer in, HydroRIVERS), relief from ETOPO 2022; the names of the ranges (`ranges.js`) and of the waters (`waters.js`). |
| `app/data/xrefs/` | The cross-references, one JSON file per book, made by the import. |
| `docs/touch-setup.md` | How to connect the touch panel through a Linux VM in UTM. |

## Colors

The colors are the reading room's: warm paper, ink, and one manuscript
pigment for each kind of thing (see "The reading room" below).
`app/styles/reading-room.css` holds the values, and `test/design.test.js`
checks each one with APCA.

## The kings' chronologies

The timeline's Kings choice puts the reigns of the kings of Israel and Judah
at Jones's dates (Theographic's, the default) or by Thiele, Galil, Albright
or Kitchen; a reign at another chronology's date is lapis, and the note
names the chronology. A reign's entry lists all of them. The data is
`app/data/chronology/kings.json`, from the tables of Wikipedia's "Kings of
Israel and Judah" (CC BY-SA), matched to Theographic's "Reign of …" events
by hand:

```sh
curl -o kings.json 'https://en.wikipedia.org/w/api.php?action=parse&page=Kings_of_Israel_and_Judah&prop=wikitext&format=json&formatversion=2'
node tools/import-kings.js kings.json
```

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

Beside the polities, the track has the rulers the Bible names, as ochre
bars (Shishak, Tiglath-pileser, Sennacherib, Nebuchadnezzar, Cyrus, the
Caesars, Pilate: 33), and dated events of the world around it, as purple
marks (Kadesh, Qarqar, Lachish, Carchemish, the fall of Babylon, Gaugamela:
9). A reign is the office a ruler held, a monarch's where there is one.
Seven reigns that Wikidata does not date (Shishak, Tirhakah, Belshazzar,
Mesha, Herod the Great, Herod Antipas, Artaxerxes I) have the usual dates,
entered by hand and marked `dates: "conventional"`; their entries say so.

## Exploring

- **Dates in the text:** a verse where a dated event's passage begins has a
  small purple diamond in the card's margin (565 of them, from Theographic's
  events). A tap opens the event in the search panel and marks its tick on
  the timeline. An event told over many verses is marked once, where it
  begins.

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
  solid by land, dashed by sea (the dashes fitted to each leg, so that it
  meets its stops), with an arrow on each leg. The dates are
  Theographic's events, by Jones's chronology, as the timeline shows them.
  Where Acts names only a region (Macedonia), the usual city is used and
  marked as a reading. Places with no coordinates, or passed by at sea, are
  left out, and a test checks every stop against its verse.
- **Journeys with every proposed route:** Abraham's (from Ur in the south,
  or from a northern Ur at Urfa), Jacob's to Haran and back, the Exodus
  (the southern route to Jebel Musa, the northern by Lake Bardawil to Jebel
  Helal, the central by the Bitter Lakes to Har Karkom, and the Arabian
  across the Gulf of Aqaba to Jebel al-Lawz), and Jesus' last journey to
  Jerusalem (through Samaria, or through Perea). The panel lists each route
  with what it rests on, and the map draws the one tapped. A proposed site
  that Theographic does not have (a Mount Sinai, Lake Bardawil, Nuweiba) is
  an ochre ring with its name in italics, placed roughly, as the legend
  says; the test checks that its verse names it.

## Pictures

66 pictures, linked to the people, places and events they show
(`app/data/images.js`): 48 photographs of the Holy Land from the G. Eric and
Edith Matson Photograph Collection at the Library of Congress (1898–1946, no
known restrictions on publication), and 18 objects from The Metropolitan
Museum of Art's Open Access (CC0), such as the Nimrud reliefs, Sennacherib's
account of his campaign against Judah, and the lion of Babylon's Processional
Way. An entry shows its first picture as a plate, with its caption and
credit, and the rest small; a passage's guide shows the pictures of the
places and people it names. A tap puts a picture on the table as a card,
whose chips open what it shows.

The picks, chosen by hand with a caption each, are in `tools/images.json`;
`node tools/import-images.js` downloads them politely (one at a time, with a
pause), makes them at most 1,100 pixels on their long side (macOS `sips`),
and writes `app/data/images.json`. It stops at a bot check rather than try
to get past one: both sources put one up after many quick requests while
the picks were chosen, so more can be added later, a few at a time.

## Videos

Three series: JESUS (1979), scene by scene, from the Jesus Film Project;
BibleProject's overview of each book; and The Chosen, seasons 1 to 5,
episode by episode. A passage's guide, and a search for a reference, list
the videos of that passage; a tap puts one on the table as a card. JESUS
and BibleProject play on the card in the app's own player
(`app/elements/video-player.html`), which fetches nothing from the source
until Play. The Chosen cannot play inside another site, so its card opens
the episode on The Chosen's own site. The guide's Listen and watch page (`/guide/listen-watch`)
tells how to use them.

Nothing is downloaded. The picks, chosen by hand with the passages of each,
are in `tools/videos.json`; `node tools/import-videos.js` finds each video
and writes `app/data/videos.json`.

## The original languages

A passage card has more versions beside KJV, BSB and Both (Syntax is under
"Syntax" below):

- **Original:** the Hebrew (with the Aramaic of Daniel and Ezra), right to
  left, or the Greek, as running text.
- **Word by word:** each word of the original over its transliteration, its
  English, its grammar in words and its Strong's number.
- **Reverse:** the reverse interlinear, the KJV in its own order with the
  word of the original under each word or phrase that renders it, matched
  by Strong's number, and its transliteration; its grammar is in its
  tooltip. English with no number of its own (a prefix's "in the", or a word
  the translators supplied) is in a softer ink.

A tap on a Hebrew or Greek word studies its Strong's number, and the KJV
words on every card that render it are underlined: that is how the original
and the KJV line up. The Hebrew is the Leningrad text with the Qere; the
Greek is the Textus Receptus, the text the KJV translated, and a word the
Nestle-Aland text does not have has a dotted ochre line. Verses are numbered
as the KJV numbers them.

### Search by a word's name

A word of the original typed as it is said, such as `agape`, `chesed`,
`shalom`, `logos`, `nephesh` or `Yahweh`, opens its word study
(`app/lib/lemma.js`): what is typed and Strong's transliterations (agápē,
chêçêd, shâlôwm) are brought to one plain spelling, without accents, and
with the usual variants made one (ch and h, th and t, ow and o, q and k).
Where the spelling fits several words, the most used opens and the others
are offered. A word the KJV also has, such as `amen` or the name Chesed,
searches the text, and offers the words of the original beside it.

### Search by grammar

The search field also takes the words of the grammar (`app/lib/grammar.js`),
in any order, with a scope at the end:

| Search | Finds |
| --- | --- |
| `aorist imperative in John` | every aorist imperative in John |
| `wayyiqtol in Ruth` | every consecutive imperfect (also `qal consecutive imperfect third masculine singular`) |
| `G26 accusative` | agapē in the accusative |
| `first person plural aorist subjunctive in the gospels` | "let us ..." in the Gospels |
| `aramaic verb in Daniel` | the verbs of Daniel's Aramaic |
| `V-AAM-2S`, `V-AAM`, `HVqw3ms` | STEPBible's own codes: Greek, or the start of one; Hebrew |

A scope is a book, a chapter (`Romans 8`), a group (the Law, the Gospels,
Paul, the Prophets) or a testament (the OT, the NT). A word matches the
values that hold it: "aorist" finds the 2nd aorist too, "middle" the middle
deponents, "pronoun" every pronoun; but "imperfect" is not the wayyiqtol.
One word alone that the KJV also has, such as "perfect", searches the text.

The answer lists the words found most often (a tap narrows the search to
one), where they are, book by book, and each verse with the Hebrew or Greek
words found and the KJV words that render them underlined. "Where, chapter
by chapter" puts its landscape on the table. On a Word by word card, a tap
on a word's grammar finds every word in that form.

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

## Syntax

`app/data/syntax/` holds every sentence of the Hebrew and the Greek as its
clauses, and each clause as its parts: subject, verb, object, indirect
object, predicate, adverbial. It comes from the syntax trees of MACULA Greek
and MACULA Hebrew (© Biblica, CC BY 4.0), and `tools/import-syntax.js`
writes it, one file for each book (23 MB in all):

```sh
node tools/import-syntax.js <macula-greek> <macula-hebrew> <directory with STEPBible's TAHOT files>
```

- **The Syntax version of a card** shows the passage's sentences whole,
  each clause on a row of its own: its parts as boxes, each with its role,
  the words of the original and their gloss. A clause inside another is
  indented under it, with where it is ("object", "in the subject"). The
  Hebrew runs from the right. A word with no role, such as "and", goes in
  front of the clause it joins.
- **A search by syntax** names roles, each with a word: "subject God verb
  love", "verb love object world", "subject theos verb agapao in John". A
  word is a Strong's number, a word of the original as it is said, or an
  English word, which stands for the words of the original that the KJV
  renders by it (at least 3 times, and at least 5% of its renderings). The
  answer is the sentences with a clause that has each word in its role, with
  those words marked in the KJV.

The Greek is Nestle's text of 1904, which differs in places from the Textus
Receptus that the KJV translated; the card says so. The Hebrew is the
Leningrad Codex, as the app's Hebrew is; MACULA numbers its words as the
Hebrew Bible does, and the import gives each word its KJV verse
(`tools/lib/versification.js`), so a psalm's title stays out of verse 1.
MACULA's senses and domains are not taken: they are UBS data used by
permission.

## Word senses

A word study lists the senses of the word: `app/data/senses.json`, from
the United Bible Societies' dictionaries (© United Bible Societies, CC BY-SA
4.0, from [ubs-open-license](https://github.com/ubsicap/ubs-open-license)):
the UBS Dictionary of the Greek New Testament, after Louw and Nida's
semantic domains, and the Semantic Dictionary of Biblical Hebrew. Each sense
has its glosses, its domain, a short definition, and every verse that uses
the word so; πνεῦμα (G4151) has 14, from "Holy Spirit" (228 verses) to
"wind" (2) and "breath" (4). A tap on a sense lists only its verses; the
search field takes the same as "G4151 sense 7". The MCP server's
`word_study` gives the senses too.

```sh
node tools/import-senses.js <the UBS dictionaries folder> <directory with STEPBible's TAHOT files>
```

The Hebrew dictionary numbers verses as the Hebrew Bible does; the import
turns them into the KJV's with STEPBible's Hebrew files, which give both.
MACULA's own Louw–Nida senses are not used: MACULA has them from UBS by
permission, not under its CC BY license.

## Topics

`app/data/topics.json` is Nave's Topical Bible (Orville J. Nave, 1896, public
domain): 5,319 topics, each with its headings and about 76,000 references in
all. It comes from the CSV file in Brady Stephenson's
[bible-data](https://github.com/BradyStephenson/bible-data) (CC BY 4.0), and
`tools/import-topics.js` writes it:

```sh
node tools/import-topics.js <NavesTopicalDictionary.csv>
```

- **A search that names a topic** ("prayer", "forgiveness", "Aaron") shows
  the topic, closed, above the verses. A tap opens it: each heading with its
  references as links, as in a dictionary entry, and "See" links to the
  topics it sends the reader to.
- **The passage guide** lists the topics that cite the passage, those that
  cite it most first; a tap opens one.
- **The MCP server's `topic` tool** gives a topic, or the topics that cite
  a passage.

The source writes the names and headings in capitals. The import writes them
in small letters, and a word keeps its capital where the entries write it
with one more often than without ("Jesus", "Moses"). A reference to a verse
that the KJV does not number (58 of them) stays text.

## References in the text

The text of Easton's dictionary and of an entry's summary names verses, as
"(Gen. 35:16, 19; 48:7; Ruth 4:11)". In the search panel each reference is a
link (`app/lib/citations.js`): a tap puts the verse on the table, and a
sideways drag pulls it out, as a result does. "19" is Genesis 35:19, and a
reference with no book, such as "(2:1, 4; 7:7)", is in the book named last,
as Easton writes it. A word such as "Is" is not taken for a book: a short
form needs its stop ("Isa."), and a chapter alone ("Gen. 12") too. A verse
that does not exist stays text. About 25,000 references in Easton are links.

The summary on an entity's card on the table has the same links: a tap puts
the passage down beside the card.

## Pasted references, and your notes in a search

Text pasted on the table, not in a field, puts down a card for each
reference in it, up to 12 (`pastedReferences` in `app/lib/citations.js`). A
line that is one reference may name a chapter alone; in running text a
reference needs its verse, so "I am 5" is not Amos 5. "John 3:16, 18; 4:1"
is three references. The table fetches only the list of books (`GET
/books`); the pasted text stays in the browser.

A typed search also lists the reader's notes that have every word of it,
on the table and in the saved tables (`app/lib/note-search.js`). Case and
accents do not matter. The notes live in the browser, so they are searched
there. A note in a saved table opens that table, as one step that undo
takes back.

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

Tools, Reading has the reader's settings
(`reading-settings`), as `/design` does. They are tiles that show what they
do: each theme and paper in its own colors, five letters for the text sizes,
drawn lines for the spacing and the layout, and a sample of each thing the
text shows. A tap outside the docked Tools panel closes it (a resting palm
does not), and so does Escape. The settings are: Day, Night, or as the
computer is,
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

## Accessibility

Checked on 2026-11-10 with a script over the table (names, roles, target
sizes, text sizes, headings, live regions) and with the keyboard; and again
against Google's modern-web-guidance guides (accessibility, toolbar, drag,
color, form-factor-adaptation, navigation-drawer, html):

- The rail is one stop for the Tab key, and the arrow keys move along it
  (`focusgroup` where Chrome has it, a roving tab index elsewhere); it says
  its orientation, and Undo and Redo stay in its order when there is nothing
  to undo (`aria-disabled`). On a phone its names are hidden from sight, not
  from a screen reader.
- A panel's grip moves the panel with the arrow keys (Shift for more), as a
  drag does, and only the main button drags; docking and floating are said
  in the toast. The float button is pressed while its panel floats.
- A field's edge has 3:1 contrast on every paper (`--field-edge`, checked in
  `test/design.test.js` by the WCAG 2 ratio).
- Hover colors show only where a pointer can hover, so a tap leaves no tint.
- On a touch screen a timeline tick takes the axis's height, a tap between
  ticks takes the nearest, and a world span is at least 24px wide.
- Heights use the small viewport (`svh`), clear of a phone's toolbars.
- The recording shows on a phone's lock screen, whose Play and Pause pause
  and go on (Media Session).

- Every control has a name. A card is a group a screen reader calls a
  "card", named by its heading, with its keys described (`#card-keys` in
  `routes/table.html`); the map's frame is a "map", with its keys.
- The Tab key stops 105 times on a full table, not 612: the timeline's ticks
  are one stop and its world spans another, and the arrow keys move within
  each (Home and End to the ends).
- The search panel says what each answer found, in a status region that
  stays (`.search__status`).
- When the Tools panel, the search panel or the timeline closes with the
  focus inside it, the focus goes to its button on the rail. The Tools tabs
  are a tab list: the arrow keys move between them.
- No text is under 11px: the smallest sizes are `max(<rem>, 11px)`, as they
  were set for the panel's 24px rem. Targets are at least 24px each way,
  but for the timeline's ticks, which stand close together; each event is
  also found by the search panel.
- The browser's own text size scales the table's rem, as the page's size
  is otherwise set in pixels for the screen.
- Motion respects `prefers-reduced-motion`; colors are checked with APCA
  (`test/design.test.js`).

Not yet done: a pass with VoiceOver and NVDA, forced colors (Windows High
Contrast), and a keyboard way to pick a place on the map (the search panel
finds every place).

## Screens, from a phone to a wall

The table sets its rem for the kind of screen, before the page paints (the
script in `routes/table.html`, and the same in `routes/design.html`). A page
knows a screen's size in CSS pixels, not in inches, so the kind is a guess:

| Screen | The rem |
| --- | --- |
| a phone: its shorter side under 600 CSS pixels | 16px |
| 2560 or more across: a 4K panel or wall at one device pixel to the CSS pixel | 24px, for arm's length |
| a laptop, a desktop or a tablet | 18px |

Interface, in Tools, Table, makes the whole interface smaller or larger
on this device: S, M (the guess), L, XL, and Far, twice M, for a wall seen
from across the room (not offered on a phone). However large the setting, a
rem is at most a 22nd of the window's shorter side, so the panels and the
settings always fit. `?ui=m` in the address sets the size back to M. Text
size is a size on top of it. The controls' text
is two thirds of the rem, and the rem itself on a phone.

At Far, the table works with a remote's keys (`app/lib/spatial.js`): the
arrow keys move the focus to the nearest card or panel control that way,
with a ring that shows at a distance, and the table pans to show a card off
the screen. With nothing in focus, the first arrow goes to the card nearest
the middle. Enter on a card opens its guide, as a tap on its heading does;
on the map, Enter steps into it, the arrow keys and + and − move it, and
Escape steps back out. In the other sizes the arrow keys move a card.

The panels slide a little way as they open, and the search panel and the
timeline as they close (`app/lib/motion.js`): only translate and opacity, which the
browser moves as a picture, and none for a reader who asks for less
motion.

On a phone (narrower than 700 pixels, or shorter than 500 on its side) the
rail is along the bottom, where a thumb reaches, with icons only. The
panels are sheets the width of the screen above it, and one is open at a
time; the search panel, with its results, fills the screen above the rail.
A panel cannot float. The timeline starts closed; open, its strip moves sideways under a finger.
A card from the search panel goes on the table at the width of the screen,
and the panel steps aside so the card shows. A field's text is 16px, so the
phone does not zoom in on it. The table takes every touch (`touch-action:
none`), so a pinch on it scales a card, not the page.

## Offline, and on the Home Screen

The app installs from the browser, or from Share, Add to Home Screen on a
phone (`public/manifest.webmanifest`), and opens full screen.

A service worker (`public/sw.js`) keeps it working without a connection. It
keeps two caches:

- **The shell:** what the build lists in `/precache.json` (`precache: true`
  in `transclude.config.js`). That is the prerendered pages, the code, the
  fonts, the icons and the map, but not the pictures. The worker fills it
  when it installs, and brings it up to the current build each time the
  table opens.
- **What the reader opened:** cards, searches, studies, cross-references
  and pictures. It keeps the newest 1,500.

Online, every page and card comes from the server, and the kept copy is
replaced. The copy answers only when the network fails, fails on the server,
or takes more than four seconds. Offline, a card that was never opened does
not load. The table keeps it in the saved table and tries again on the next
visit. A page that was never opened shows `/offline`. The recordings, the
videos and the MCP bridge always go to the network. Under the dev server
there is no `/precache.json`, so the worker passes everything on.
`test/sw.test.js` runs the worker in a sandbox.

Saving a table under a name asks the browser for persistent storage
(`app/lib/persist.js`), so the saved tables and the caches are not cleared
to make space, or, in Safari, after seven days without a visit. Chrome and
Safari decide without asking; Firefox asks the reader once. If the browser
refuses, the Saved tab says so and points to a file.

The icons come from two drawings, `public/icons/app.svg` and
`public/icons/favicon.svg`. `npm run icons` (`tools/icons.js`, which needs
`rsvg-convert`) makes the PNGs, the maskable icon and `favicon.ico` from them.

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
Earth still gives the rivers of the whole map, and its list of natural lakes
decides which of GSHHG's lakes stay (a reservoir such as Lake Nasser does
not).

Closer in, the rivers are HydroRIVERS's (Lehner and Grill 2013,
hydrosheds.org), finer: every reach with an average flow of 3 m³/s or more,
which keeps the Kishon, the Arnon and the Abana, drawn by size; and the large
wadis, dry most of the year, dashed, such as the Brook of Egypt. HydroRIVERS
has one channel where a river splits, so the Nile's delta keeps Natural
Earth's branches. HydroRIVERS is under the HydroSHEDS license (free use with
attribution; passed on only inside a work made from it). RiverATLAS
(HydroATLAS) holds the same reaches under CC BY 4.0, but its download
(figshare) stops automated clients; a download of it by hand can replace
HydroRIVERS with no change to the map. Run the Natural Earth import first,
then the coast, then the rivers:

```sh
node tools/import-map.js <Natural Earth GeoJSON directory>
node tools/import-coast.js <directory with GSHHS_f_L1.shp and GSHHS_f_L2.shp>
node tools/import-rivers.js <directory with HydroRIVERS_v10_eu and _af .shp and .dbf>
```

The map card is in the reading room's style, and is drawn to be light:

- The card first brings a light map (about 1 MB, 260 KB compressed): the
  coast simplified to about 2 km and coarse relief bands. The detail (the
  close coast and lakes, the fine bands, and the Levant's sharper relief,
  about 3 MB, 1 MB compressed) is fetched a moment after the card shows,
  from the card's `detail` fragment (`?part=detail`), and goes in from a zoom
  of 2.5.
- The sea is drawn over the relief, cut to the coast and edged with it, so
  nothing is clipped. The hill shade is black and white with alpha, so it
  needs no blend mode. Line widths are divided by the size of a map unit, in
  place of `vector-effect: non-scaling-stroke`.
- While the map moves, the frame moves a picture of it and draws it again
  when it stops, so a pinch stays at the screen's frame rate. The picture is
  drawn with a margin of half the frame on each side, outside the frame, and
  is always a layer of its own: the browser draws the margin while nothing
  moves, so a pan, or a zoom out to half the size, shows the map around the
  view at once, not a blank edge. The browser also moves that layer, as a
  card or the table moves, without drawing it again.
- The map is two layers: the base (land, sea, rivers), heavy to draw, and
  over it the places and names, light, so a name that comes or goes does not
  draw the land again. On a screen of more than 2 device pixels to the CSS
  pixel, such as a phone's, the base is drawn at 1.5 and scaled up: a phone
  draws the land where the processor, not the graphics chip, does the work,
  and this is a quarter of the pixels. The names keep the screen's density.
- A place shows its dot from one level before its name, so the whole map
  shows about 80 dots, not 1,257; at the closest level every place shows.
  Names and dots cross-fade as they come and go at a new level.

The ancient world: the map's Show choice, under its zoom buttons, puts
one layer over today's map: the extent of the Persian Empire (about 500
BC), of Alexander's empire (323 BC), of the Hasmonean kingdom (about 76
BC), of Rome (60 BC), of Herod's kingdom (4 BC) and of the Roman Empire
(AD 117), as a purple tint with a dashed edge; the Roman provinces of AD
200, as dashed lines; or the shores of the archaic, classical, Hellenistic
or Roman age, as water with a lapis dashed edge over what is land now (the
Latmian Gulf at Miletus, the harbor of Ephesus). The choice is kept on the
device. The data is `app/data/map/ancient.json` (138 KB), from the Ancient
World Mapping Center's geodata, derived from the Barrington Atlas (ODbL);
the files have no names, so the names and dates are written by hand from
AWMC's titles, and the dates are approximate:

```sh
node tools/import-ancient.js <directory with the AWMC GeoJSON and shoreline files>
```

The relief: `app/data/map/relief.json` holds, for each
of six heights (200, 500, 1,000, 1,500, 2,000 and 3,000 m), the land at or
above it as one path; its edge is the contour line. `app/public/map/` holds
two hill shades, lit from the northwest: one of the whole map, and a sharper
one of the Levant for a close view, which also has its own contours. Each
shade is gray and alpha: black where a slope is turned from the light, white
where it is turned to it. `far` in `relief.json` is the bands again,
coarser, for the whole map. Both
come from NOAA's ETOPO 2022 (free to use and share), through NOAA's ERDDAP
service, and need nothing but Node to build:

```sh
curl -o etopo-30s.nc 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.nc?z%5B(18):2:(46)%5D%5B(8):2:(62)%5D'
curl -o etopo-15s-levant.nc 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.nc?z%5B(29.2):1:(34.6)%5D%5B(33.4):1:(37.8)%5D'
node tools/import-relief.js etopo-30s.nc --levant etopo-15s-levant.nc
```

The first file is 87 MB and the second 5.5 MB; the outputs are 2.4 MB of
paths and 3.1 MB of images.
## The BSB data

`app/data/bsb/<BOOK>.json` holds the Berean Standard Bible (public domain) by
the KJV data's verse addresses: `{ "JHN.3.16": [{ "style": "p", "text": "For God so loved ..." }] }`.
A block with footnotes has `notes`, each the place in the text it follows and
its words: `"notes": [{ "at": 53, "text": "Or and tabernacled among us" }]`.

```sh
node tools/import-bsb.js <usfm directory from eBible.org's engbsb_usfm.zip>
```

The 4,846 footnotes are kept (`tools/lib/bsb-notes.js`): each is held in the
text as a mark while the lines are read, then taken out with its place, so
the text is the same as with no footnotes. A card shows each as a letter
after its word, a, b, c through the verse (`app/lib/footnotes.js`), and a tap
shows the note. Section headings and Strong's tags are left out. A psalm
title joins verse 1, as in the KJV data. 31,086 verses; the 16 KJV verses
with no BSB text have no entry.

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

## An MCP server for the data and the table

`tools/mcp-server.js` lets an assistant such as Claude use this app through
the Model Context Protocol. It speaks MCP over stdin and stdout with no
library. Its research tools read `app/data` directly, so the app need not be
running, and change nothing: the same search, texts, word studies, people,
places, events, cross-references, quotations, journeys and passage guides
the table shows.

| Tool | What it answers |
| --- | --- |
| `search` | the search field: words, a reference, a Strong's number, a word's name (agape), or grammar (aorist imperative in John) |
| `passage` | a passage in the KJV, the BSB, the original, word by word, or the reverse interlinear |
| `word_study` | a Strong's entry, how the KJV renders it, where it occurs |
| `entity` | a person, place, group or event, with its relations, dates and verses |
| `cross_references` | a verse's cross-references, best first |
| `quotations` | the Old Testament a New Testament verse quotes, or where an Old Testament verse is quoted |
| `journeys` | a person's journeys, with every proposed route and the verse of each stop |
| `topic` | a topic of Nave's Topical Bible, or the topics that cite a passage |
| `passage_guide` | a passage's parallels, quotations, cross-references, and what it names |

Its table tools act on the tables that are open in a browser, through a
relay in the app (`app/server.js`): the tool sends a command, every open
table hears it on a stream, carries it out with its own methods, and the
first to answer replies. So each change is a step that Undo takes back.

| Tool | What it does on the table |
| --- | --- |
| `table_state` | what is on the table: its cards, its links and its marks |
| `table_link` | links two cards on the table, with a type (quotes, fulfills, contrasts), or takes the link away |
| `table_study` | lays out a study of a passage, a Strong's number, a topic, or a person, place, event or group, as Start a study does |
| `table_note` | writes a note (a title, a kind, text with `#` headings) beside the cards it links to |
| `table_place` | puts passages down in a row, in any version, as one step |
| `table_guide` | opens a passage's guide in the search panel |
| `table_search` | searches in the search panel |
| `table_show_entity` | shows a person, place, group or event in the panel |
| `table_show_places` | marks places on the map, and zooms to them |
| `table_show_journey` | draws a journey on the map, by the route chosen |
| `table_mark` | marks words on every card (a Strong's number, a name, the words of Christ), or takes a mark off |
| `table_clear` | a new, empty table (Undo brings the old one back) |
| `table_undo` | takes back the last change |

A command must carry the secret in `TABLE_TOKEN`, from the project's `.env`
(copy `.env.example` and fill it in): the server listens on the network, so
the panel can reach it, and a command changes the table. The table tools
need the app running (`npm run dev`) and a table open; `BIBLE_URL` says
where the app is, if not `http://127.0.0.1:1960`. On Cloudflare there is no
relay, and a table stops listening after its first try.

Every answer gives addresses (JHN.3.16) beside references, and names its
sources. To use it in Claude Code, from this folder:

```sh
claude mcp add bible -- node "$PWD/tools/mcp-server.js"
```

In the Claude desktop app, add it to `claude_desktop_config.json` under
`mcpServers`: `"bible": { "command": "node", "args": ["<this folder>/tools/mcp-server.js"] }`.

## The Old Testament in the New

A New Testament verse where a quotation of the Old Testament begins, and an
Old Testament verse quoted in the New, has a lapis quotation mark in the
card's right margin; a tap lists the other side in the search panel, and
the passage guide has a section for it. There are 603 quotations
(`app/data/quotations.json`), from two sources. Both mark quotations, not
allusions.

- **Nestle's Greek New Testament (1904):** the quotations it prints in bold,
  with its margin's references (476). The markup is MACULA Greek's (CC BY
  4.0; the Nestle text is in the public domain), and it covers the Gospels,
  Acts, Romans, and Galatians to Titus. One pair the markup has wrong
  (Romans 1:23 with Habakkuk 2:4) is left out.
- **The UBS Parallel Passages Database** (© 2023 United Bible Societies,
  CC BY-SA 4.0), for every book: the quotations Nestle's markup does not
  have (127), most of them in Hebrews, 1 and 2 Corinthians, James and
  1 Peter. A pair that Nestle has already is not added twice. The database
  numbers the Old Testament as the Hebrew Bible does (its Psalm 22:2 is the
  KJV's 22:1), and the import turns those numbers into the KJV's with
  STEPBible's Hebrew files, which give both (`tools/lib/versification.js`).

```sh
node tools/import-quotations.js <MACULA Greek's Nestle1904/tei> --ubs <ParallelPassages.xml> --tahot <directory with STEPBible's TAHOT files>
```

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
a later chapter keeps its whole range (630 targets, such as `JOS.5.13-6.2`),
as a card address can cross a chapter; one that runs into another book stops
at the end of its first chapter. The license is CC BY, so the app credits
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

