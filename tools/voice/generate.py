#!/usr/bin/env python3
"""The app's own reading voice: a Bible version read aloud, a file to a chapter.

    python tools/voice/generate.py --voice plain-male --version kjv --books JHN [--books ...]

Run it with the Python that has qwen-tts (see tools/voice/README.md), from the
project's folder. Settings by environment:
    QWEN_BASE      the Qwen3-TTS-12Hz-1.7B-Base model folder (a Hugging Face snapshot)
    WHISPER_MODEL  whisper.cpp's ggml-base.en.bin, for the check of each verse
    VOICE_WORK     a folder for the work in progress (default: .voice-work)
    BIBLE_AUDIO    the folder of the recordings, as the app reads it (default: audio)
    VOICE_REFERENCE  the folder of the voices' clips (default: tools/voice/reference,
                   which git ignores: the clips are not part of the project)

A voice is its reference clip and its words, <VOICE_REFERENCE>/<voice>.wav
and .txt: a voice designed by description (Qwen3-TTS VoiceDesign) and then
locked by cloning one verse of it with the Base model, so that every verse is
read by the same reader. Another voice is another clip: --voice calm-male.

Each verse is read alone, with a seed made from its address, so a run again
gives the same take. Each take is checked: whisper transcribes it, and a take
with too many words wrong (more than MAX_WER) is read again with the next
seed, up to TRIES times; the best take is kept. The verses of a chapter are
trimmed of silence, joined with a pause, softened in the treble (SOFTEN),
made even in loudness, and encoded
as AAC (mono, 48 kb/s): <BIBLE_AUDIO>/<voice>/<version>/<BOOK>.<chapter>.m4a,
outside git. The time each verse begins goes into times.json beside them, in
the form that app/data/audio.js reads (docs/recordings.md):
    { source, chapters: { "JHN.1": [seconds, [start of each verse, in tenths]] } }
The voice's name, which the app shows, goes into <BIBLE_AUDIO>/<voice>/voice.json
if it has none. A chapter already made is not made again, so a run that stops
goes on.
"""

import argparse, hashlib, json, os, re, subprocess, sys, tempfile, time
import numpy as np
import soundfile as sf

MAX_WER = 0.2
TRIES = 4
PAUSE = 0.55  # seconds between verses
SR = 24000
# The voice model adds a fizz above 7 kHz that is heard as hiss; a gentle
# shelf takes 6 dB off it (chosen by ear, 2026-11-10). The chapters
# made before it are listed in softened.txt once tools/voice/soften.js has
# treated them; a chapter made here is listed as it is made.
SOFTEN = 'highshelf=f=7000:g=-6:t=s:w=0.7'
# The model picks each sound at random among the likely ones; at its default
# (0.9) a rare name is said a different way from verse to verse (Eliakim).
# At 0.6 the reading is steadier and still natural: chosen by ear over
# respelled names, which sounded spelled out (2026-11-11).
TEMPERATURE = 0.6

ap = argparse.ArgumentParser()
ap.add_argument('--voice', default='plain-male')
ap.add_argument('--version', default='kjv', choices=['kjv', 'bsb'])
ap.add_argument('--books', action='append', required=True)
args = ap.parse_args()

ROOT = os.getcwd()
WORK = os.environ.get('VOICE_WORK', os.path.join(ROOT, '.voice-work'))
RECORDINGS = os.path.join(ROOT, os.environ.get('BIBLE_AUDIO') or 'audio')
OUT = os.path.join(RECORDINGS, args.voice, args.version)
TIMES = os.path.join(OUT, 'times.json')
VOICE = os.path.join(RECORDINGS, args.voice, 'voice.json')
WHISPER = os.environ['WHISPER_MODEL']
LEXICON = json.load(open(os.path.join(ROOT, 'tools', 'voice', 'lexicon.json')))
os.makedirs(OUT, exist_ok=True)

# ---- The text -------------------------------------------------------------

def verses_of(book):
    """Each verse of a book in order: (address, text as printed)."""
    if args.version == 'kjv':
        data = json.load(open(os.path.join(ROOT, 'app', 'data', 'kjv', f'{book}.json')))
        for chapter in data['chapters']:
            for verse in chapter['verses']:
                text = ' '.join(''.join(run['text'] for run in block['runs']) for block in verse['blocks'])
                yield verse['id'], text
    else:
        data = json.load(open(os.path.join(ROOT, 'app', 'data', 'bsb', f'{book}.json')))
        for address, blocks in data.items():
            yield address, ' '.join(block['text'] for block in blocks)

def spoken(text):
    """The text as the voice is given it: the pilcrow gone, LORD and GOD as
    words (not letters), straight quotes, and the lexicon's respellings of
    names (tools/voice/lexicon.json), whole words only."""
    text = text.replace('¶', ' ').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    text = re.sub(r'\bLORD\b', 'Lord', text)
    text = re.sub(r'\bGOD\b', 'God', text)
    for word, said in LEXICON.items():
        text = re.sub(rf'\b{re.escape(word)}\b', said, text)
    return re.sub(r'\s+', ' ', text).strip()

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = '_ _ twenty thirty forty fifty sixty seventy eighty ninety'.split()
def n2w(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + n2w(n % 100))
    return n2w(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + n2w(n % 1000))

def words(text):
    text = text.lower().replace('’', "'").replace('-', ' ')
    text = re.sub(r'\d+', lambda m: ' ' + n2w(int(m.group())) + ' ', text.replace(',', ''))
    text = re.sub(r"[^a-z' ]", ' ', text).replace("'", '')
    return text.split()

def wer(reference, heard):
    r, h = words(reference), words(heard)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        previous, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            previous, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, previous + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(len(r), 1)

def transcribe(wave):
    with tempfile.NamedTemporaryFile(suffix='.wav') as f:
        resampled = np.interp(np.arange(0, len(wave), SR / 16000), np.arange(len(wave)), wave).astype(np.float32)
        sf.write(f.name, resampled, 16000)
        out = subprocess.run(['whisper-cli', '-m', WHISPER, '-f', f.name, '-np', '-nt'], capture_output=True, text=True)
        return out.stdout.strip()

def trim(wave):
    level = np.abs(wave)
    threshold = max(level.max() * 10 ** (-40 / 20), 1e-4)
    loud = np.where(level > threshold)[0]
    if len(loud) == 0:
        return wave
    pad = int(0.05 * SR)
    return wave[max(loud[0] - pad, 0): min(loud[-1] + pad, len(wave))]

# ---- The voice ------------------------------------------------------------

import torch
from qwen_tts import Qwen3TTSModel

device = 'mps' if torch.backends.mps.is_available() else 'cpu'
model = Qwen3TTSModel.from_pretrained(os.environ['QWEN_BASE'], device_map=device, dtype=torch.bfloat16, attn_implementation='sdpa')
reference = os.path.join(os.environ.get('VOICE_REFERENCE') or os.path.join(ROOT, 'tools', 'voice', 'reference'), args.voice)
prompt = model.create_voice_clone_prompt(ref_audio=f'{reference}.wav', ref_text=open(f'{reference}.txt').read().strip())

def read(address, text):
    """The best of up to TRIES takes of a verse, and its word error rate."""
    base = int(hashlib.sha1(f'{args.voice}:{address}'.encode()).hexdigest()[:8], 16)
    best = None
    for attempt in range(TRIES):
        torch.manual_seed(base + attempt)
        wavs, sr = model.generate_voice_clone(text=spoken(text), language='English', voice_clone_prompt=prompt, temperature=TEMPERATURE)
        assert sr == SR, sr
        wave = trim(np.asarray(wavs[0], dtype=np.float32))
        error = wer(text, transcribe(wave))
        if best is None or error < best[1]:
            best = (wave, error, attempt)
        if error <= MAX_WER:
            break
    return best

# ---- The chapters ---------------------------------------------------------

times = json.load(open(TIMES)) if os.path.exists(TIMES) else {
    'source': 'Read with Qwen3-TTS (Apache 2.0) by tools/voice/generate.py',
    'chapters': {},
}
if not os.path.exists(VOICE):
    json.dump({'reader': args.voice.replace('-', ' ').replace('_', ' ').capitalize()}, open(VOICE, 'w'))

for book in args.books:
    chapters = {}
    for address, text in verses_of(book):
        key = '.'.join(address.split('.')[:2])
        chapters.setdefault(key, []).append((address, text))
    for key, verses in chapters.items():
        out = os.path.join(OUT, f'{key}.m4a')
        if os.path.exists(out) and key in times['chapters']:
            continue
        started = time.time()
        parts, starts, position, retried, worst = [], [], 0.0, 0, 0.0
        for address, text in verses:
            wave, error, attempt = read(address, text)
            retried += attempt > 0
            worst = max(worst, error)
            if error > MAX_WER:
                print(f'  {address}: kept a take with {error:.0%} of words heard wrong', flush=True)
            starts.append(round(position * 10))
            parts.append(wave)
            parts.append(np.zeros(int(PAUSE * SR), dtype=np.float32))
            position += len(wave) / SR + PAUSE
        joined = np.concatenate(parts[:-1])
        with tempfile.NamedTemporaryFile(suffix='.wav') as f:
            sf.write(f.name, joined, SR)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f.name, '-af', f'{SOFTEN},loudnorm=I=-18:TP=-1.5', '-ar', '24000', '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', out], check=True)
        with open(os.path.join(OUT, 'softened.txt'), 'a') as listed:
            listed.write(key + '\n')
        times['chapters'][key] = [round(len(joined) / SR), starts]
        json.dump(times, open(TIMES, 'w'))
        spent = time.time() - started
        print(f'{key}: {len(verses)} verses, {len(joined) / SR:.0f} s of audio in {spent:.0f} s; {retried} read again; worst {worst:.0%}', flush=True)
