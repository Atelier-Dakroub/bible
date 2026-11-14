# An AI assistant

This page tells you what an AI assistant, such as Claude, can do with the app through its MCP server.

## What the server is

The app has a server for the Model Context Protocol (MCP). An assistant that speaks MCP can use it. The person who set up the app adds the server to the assistant once. The developer notes of the app tell how.

The assistant then answers from the same data that the table shows. Each answer gives its sources, and the address of each verse, such as JHN.3.16, beside the reference.

## What it can read

These tools read the data. They change nothing, and they work also when the app is not running.

| Tool | What it gives |
| --- | --- |
| Search | The same answers as the search field: words, a reference, a Strong's number, a word of the original, or grammar |
| Passage | A passage in the KJV, the BSB, the original, word by word, the reverse interlinear or the syntax |
| Word study | A Strong's entry, its senses, how the KJV renders it, and where it occurs |
| Entity | A person, place, group or event, with its relations, dates and verses |
| Cross-references | The cross-references of a verse, best first |
| Quotations | The Old Testament that a New Testament verse quotes, or where an Old Testament verse is quoted |
| Journeys | The journeys of a person, with each proposed route and the verse of each stop |
| Topic | A topic of Nave's Topical Bible, or the topics that cite a passage |
| Passage guide | The parallels, quotations and cross-references of a passage, and what it names |

## What it can do on your table

These tools work on the table that is open in your browser. Each change is one step, so **Undo** takes it back.

| Tool | What it does |
| --- | --- |
| Table state | Reads what is on the table: its cards, its links and its marks |
| Table link | Links two cards on the table, with a type such as "quotes" or "fulfills", or takes the link away |
| Table study | Lays out a study of a passage, a word, a topic or a person, as **Start a study** does |
| Table note | Writes a note on the table, with headings, beside the cards it links to |
| Table place | Puts passages on the table in a row, in any version |
| Table guide | Opens the guide of a passage in the search panel |
| Table search | Searches in the search panel |
| Table show entity | Shows a person, place, group or event in the search panel |
| Table show places | Marks places on the map and zooms to them |
| Table show journey | Draws a journey on the map, by the route chosen |
| Table mark | Marks words on every card, or takes a mark off |
| Table clear | Starts a new, empty table |
| Table undo | Takes back the last change |

The server tells the assistant to look at the table first, to change it only when you ask, and to ask you before it clears the table. Undo brings a cleared table back.

## What the table tools need

- The app must run on your own computer, not on a web host, and a table must be open in a browser.
- The server must have the secret of the table, `TABLE_TOKEN`, in the settings of the app. Without the secret, the table tools do not work. The tools that read the data do not need it.
