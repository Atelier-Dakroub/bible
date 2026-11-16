# Recordings

By default, the app reads aloud in the device's own voice. A copy of the app that
you run yourself can also play recordings: a voice made with AI on your own
computer, or your own voice. This page tells you how to make recordings and how
to turn them on.

Recordings work only in a copy that runs with Node (`npm run dev` or
`npm start`). The copy on Cloudflare has no recordings.

## How a recording works

A recording has one audio file for each chapter, and a list of the times at
which each verse starts. With these times, the card marks the verse that the
voice reads, and a tap on a verse plays from that verse.

A recording can read the KJV, the BSB or both. Where a recording has no file for
a chapter, the device's voice reads that chapter.

## Turn recordings on

1. Put the recordings in a folder, in the layout below. The usual folder is
   `audio` in the app's folder. Git ignores that folder.
2. In the file `.env` in the app's folder, add this line. Use the name of your
   folder:

   ```sh
   BIBLE_AUDIO=audio
   ```

   If there is no `.env` file, copy `.env.example` to `.env` first.
3. Stop the app and start it again.
4. Open **Tools**, **Reading**. Under **Read aloud**, a choice now shows:
   **Recording** or **This device**.

The app looks for new voices and new chapters each minute, so you can add files
while the app runs.

## The layout of the folder

```text
audio/
  my-voice/
    voice.json        the name that the app shows (you can leave it out)
    kjv/
      GEN.1.m4a       one file for each chapter
      GEN.2.m4a
      …
      times.json      the time at which each verse starts
    bsb/
      …
```

- **The voice's folder** (`my-voice`): use letters, numbers, `-` and `_`. You
  can have more than one voice. The app uses the first voice, in the order of
  the alphabet, that has the chapter.
- **`voice.json`**: `{ "reader": "Joe's voice" }`. Without it, the app makes a
  name from the folder's name: `my-voice` shows as "My voice". The name shows on
  a phone's lock screen.
- **The version's folder**: `kjv` or `bsb`.
- **A chapter's file**: the book's code, a dot, the chapter's number and `.m4a`,
  for example `JHN.3.m4a`. The codes are the codes of the app's addresses: `GEN`,
  `EXO`, `LEV` … `MAT`, `MRK`, `LUK`, `JHN` … `REV`. A card's address shows the
  code, for example `JHN.3.16`. The audio must be AAC in an `.m4a` file.
- **`times.json`**:

  ```json
  { "chapters": { "JHN.3": [312, [0, 81, 164, 240]] } }
  ```

  For each chapter: its length in seconds, then the time at which each verse
  starts, in tenths of a second. The first number of the list is verse 1. The
  list needs a number for every verse of the chapter.

You do not have to write the files or the times yourself. The two ways below
make them for you.

## Way 1: a voice made with AI

`tools/voice/generate.py` reads the Bible aloud with Qwen3-TTS, a speech model
that runs on your own computer. The text does not go to a server. The model and
its code have the Apache 2.0 license.

- **You need:**
  - A computer with a good GPU, or a Mac with Apple silicon.
  - Python 3.12.
  - ffmpeg.
  - whisper.cpp. It listens to each verse and reads it again if the voice
    said too many words wrong.
  - The model, about 4 GB.
- **Time:** on an M4 Max, a whole version takes about 60 hours. The Gospel of
  John takes about 2 hours. If the run stops, start it again: it goes on from
  the next chapter.
- **The voice:** a voice is a short clip and its words. You design it from a
  description of the voice that you want. The app does not include a voice,
  so you make your own. The tool's README gives the descriptions of three
  voices as examples.

[tools/voice/README.md](../tools/voice/README.md) tells you how to set it up
and how to start a run. The tool writes the chapter files and
`times.json` to `audio/<voice>/<version>/` (or to the folder in `BIBLE_AUDIO`),
and the voice's name to `voice.json`.

Do not copy the voice of a real person without their permission.

### Other AI voices

Any speech program can make a recording if it saves one file for each verse.
Piper, for example, is free and runs on your own computer. Save the verses in
the layout of [Way 2](#way-2-your-own-voice), then join them with
`tools/join-verses.js`.

## Way 2: your own voice

Record one file for each verse, then let `tools/join-verses.js` make the
chapters and the times.

1. **Record.** Put each verse in its own file, in a folder for its chapter:

   ```text
   verses/
     JHN.3/
       1.wav
       2.wav
       …
       36.wav
   ```

   The name of the file is the number of the verse. Any format that ffmpeg
   reads is good: `.wav`, `.m4a`, `.mp3`, `.flac`. Silence at the start and the
   end of each file is removed, so you do not have to cut it exactly.

2. **Join.** Install ffmpeg, then run this in the app's folder:

   ```sh
   node tools/join-verses.js --voice my-voice --version kjv --from verses
   ```

   Add `--books JHN` to join only some books. The tool puts a pause of about
   half a second between the verses, makes the loudness even, and writes the
   chapters and `times.json` to `audio/my-voice/kjv/` (or to the folder in
   `BIBLE_AUDIO`).

3. **Turn the recordings on**, as in [Turn recordings on](#turn-recordings-on).

- **A chapter needs every verse.** If a verse is missing, the tool says which
  one and does not make that chapter. The other chapters are not affected.
- **Run it again after you record more.** It makes only the chapters that it has
  not made yet. To make a chapter again, delete its `.m4a` file.

Tips for a good recording:

- Record in a quiet room with soft things around you, such as curtains or a
  sofa.
- Use the same microphone, the same distance and the same room for every
  verse.
- Read the version that you name in `--version`. The KJV and the BSB do not
  always have the same verses.

## The texts

The KJV is in the public domain in most countries. In the United Kingdom, the
Crown has rights to it. The BSB is in the public domain. A recording that you
make is yours. If you share it, you choose its license.
