# Security

## Report a problem

Please report a security problem privately, not in a public issue: use
"Report a vulnerability" on the repository's Security tab (GitHub's private
reporting). Say what an attacker can do, and the steps that show it. You will
have an answer within a week.

Only the latest version on the main branch gets fixes.

## What to know when you run the app

- **The dev server is for a trusted network.** `npm run dev` listens on every
  network interface, so the table can be opened from a touch screen or a
  phone. It serves the project's files (not `.env`). Keep secrets out of the
  project folder, and do not run the dev server on a public network.
- **The table relay needs its secret.** The MCP server sends commands to the
  open table through `app/server.js`. Set `TABLE_TOKEN` in `.env` (see
  `.env.example`): with no token, the relay takes no commands.
- **Your work stays in your browser.** The app has no accounts. The table and
  its notes are kept in the browser's storage, and in the files you save.
- **A table file from someone else is data.** The app reads only what a table
  can hold from it, within limits, and does not run anything in it.
