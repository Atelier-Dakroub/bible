# The app's own reading voice

A Bible version read aloud in a voice of our own, a file to a chapter, with the
time each verse begins. The app plays it on a card's speaker (Tools, Reading,
Read aloud: Voice, "Recording") when `BIBLE_AUDIO` names the folder of the
recordings; `app/data/audio.js` finds them. `docs/recordings.md` is the guide
for anyone who makes their own.

## The voices

A voice is a short clip and its words in `reference/`:

- `plain-male`: the app's voice, chosen on 2026-11-10. A man of about 40, plain
  and direct, a natural pace, neither deep nor solemn.
- `calm-male`: a calm, soft-spoken man of about 45, unhurried and gentle.
- `plain-female`: a woman of about 40, plain and direct.

Each was designed by description with Qwen3-TTS VoiceDesign, then locked:
one verse it read is the reference that the Base model clones for every verse,
so a whole Bible is one reader. (Designed alone, the voice drifts from passage
to passage.) The descriptions:

- plain-male: "A man of about 35 to 45 with a natural mid-range voice, not deep
  and not a baritone. Plain and direct, like a good teacher reading aloud to a
  class or a news reader: clear diction, a natural conversational pace, not
  solemn, not theatrical, no mystery. Some warmth and feeling where the text
  calls for it."
- calm-male: "A calm, soft-spoken man of about 45. A smooth, even,
  mid-to-low voice that is not deep and not booming. He speaks quietly and
  close, as to one person in a still room. The pace is unhurried but
  conversational. Diction is precise and gentle, with steady pitch and few
  swings: reassuring, relaxed and kind, never dramatic, never theatrical, no
  mystery and no menace."
- plain-female: as plain-male, for a woman, "not breathy".

A new voice: design it (Qwen3-TTS-12Hz-1.7B-VoiceDesign, `generate_voice_design`
with a description), pick one verse of 6 to 15 seconds that sounds like the
voice at its most typical, and put it and its words here as `<name>.wav` and
`<name>.txt`.

## Making a recording

The model and its Python environment are in `../bible-voice` (beside this
project, outside git), with a script that runs this one:

```sh
../bible-voice/run.sh --voice plain-male --version kjv --books JHN --books ROM
```

Without it: `QWEN_BASE=<Qwen3-TTS-12Hz-1.7B-Base folder> WHISPER_MODEL=<ggml-base.en.bin>
<python with qwen-tts> tools/voice/generate.py …`.

- Each verse is read alone, with a seed from its address (the same take
  again on a second run), and checked by whisper; a take with more than 20%
  of its words heard wrong is read again with the next seed, up to four times.
  The model samples at a temperature of 0.6, not its default 0.9, so that a
  rare name is said the same way in each verse (chosen by ear, 2026-11-11;
  respelled names were tried and sounded spelled out). The chapters made
  before then (the KJV's Matthew, Mark, John, 3 John and Luke 1–20, and the
  BSB's John) were read at 0.9.
- The chapter's verses are joined with a pause, made even in loudness, and
  encoded as AAC (48 kb/s): `<BIBLE_AUDIO>/<voice>/<version>/<BOOK>.<chapter>.m4a`
  (`audio` when `BIBLE_AUDIO` is not set), outside git. The times go into
  `times.json` beside them, and the voice's name into `<voice>/voice.json`.
- A chapter already made is skipped, so a run that stops goes on.
- `lexicon.json` respells names for the voice ("Lamech": "Lamek").
- Speed on an M4 Max: a little faster than the audio's own length (about
  0.8 of it), so a whole version (about 80 hours of audio) takes about 60
  hours; John takes about 2.

## Setup

Python 3.12 with `qwen-tts` (Apache 2.0) and its PyTorch, the Qwen3-TTS Base
model from Hugging Face (Qwen/Qwen3-TTS-12Hz-1.7B-Base, Apache 2.0, about
4 GB), ffmpeg and whisper.cpp (`whisper-cli`) with ggml-base.en.bin. Keep the
model and the environment in a folder that lasts: `../bible-voice`, whose
`requirements.txt` rebuilds the environment.
