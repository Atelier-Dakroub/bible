# Contributing

Thank you for helping with the Bible table. This page tells you how to run
the app, how to check a change, and how to add data.

## Run the app

1. Install Node 22.9 or later (`.nvmrc` names the version).
2. Run `npm install`.
3. Run `npm run dev`, and open http://localhost:1960/table.

All the texts, dictionaries, maps and pictures are in the repository, so the
app runs at once. The recordings are not: without them, the device's own
voice reads aloud (see the README).

## Check a change

Run `npm run verify` before you send a change. It runs these checks:

- `npm run crap`: the tests (`node --test`), with each function's CRAP score.
- `npm run check`: the types (TypeScript, from the JSDoc in the code).
- `npm run build`: the production build.

The CRAP score is complexity² × (1 − test coverage)³ + complexity. A function
may not score more than 30. `tools/crap-baseline.json` lists the functions
over the limit when the check began; that list can only get shorter. If your
change makes a function too complex, split it into small functions, or move
its decisions into a tested function in `app/lib`. After you split a function
on the list, run `node tools/crap.js --update`.

Then try the change in the app: on a desktop, at the width of a phone, and
with the keyboard alone.

## Write code

- The app is HTML first, on Transclude: elements in `app/elements`, pages in
  `app/routes`, logic with no page in `app/lib`, and data access in
  `app/data`.
- Write comments in plain English: short sentences, the active voice, one
  word for one meaning. A comment says why, or what the code cannot say.
- Give each function a JSDoc comment with its types.
- Put a test in `test/` for each function in `app/lib` and `app/data`.

## Add or change data

Do not change the files in `app/data` by hand. Each one is made by a tool in
`tools/` (`tools/import-*.js`) from a source that you download; the tool's
header tells you where. Change the tool, run it, and commit the tool and its
output together.

A new source must have an open license that lets the app show it. Add it to
`DATA-LICENSES.md` and to the Credits page (`app/routes/credits.html`), with
its creator, its license, a link to the license, a link to the source, and
what the tool changes.

## Report a problem

Open an issue with the steps that show the problem, what you expected, and
what happened. For a security problem, see `SECURITY.md`.
