# Panel session

A checklist for the first session with every feature on the 32" panel. It
tests what synthetic touches on a Mac cannot: real hands, real speed, and the
GPU in the VM. Write down what fails, and how, next to each step.

## Before

1. Start the Fedora VM in UTM and pass `ILITEK-TOUCH` to it.
2. On the Mac, run `npm run dev` in this project.
3. Copy the latest launch script into the VM:
   ```sh
   scp tools/vm/table <user>@<vm-address>:bin/table
   ```
4. In the VM, switch to a text console (`sudo chvt 3`) and log in.

## 1. The GPU (10 minutes)

Chrome's GPU process fails in the VM, so Chrome draws in software. Try these
flags one at a time. Each opens Chrome's GPU page; read **Graphics Feature
Status** and note how many lines say "Hardware accelerated". Option + F4 closes
Chrome.

```sh
table chrome://gpu
TABLE_FLAGS="--ignore-gpu-blocklist" table chrome://gpu
TABLE_FLAGS="--use-angle=gl" table chrome://gpu
TABLE_FLAGS="--use-angle=gles" table chrome://gpu
TABLE_FLAGS="--use-gl=egl" table chrome://gpu
```

Keep the flags that give the most hardware acceleration for the rest of the
session, for example `export TABLE_FLAGS="--use-angle=gl"`.

## 2. Speed (10 minutes)

```sh
table "http://192.168.64.1:1960/table?perf"
```

The readout in the top right corner shows the frame time, the worst frame,
and the time the lines take. 16.7 ms is 60 frames a second.

1. With an empty table, pan for five seconds. Note the numbers.
2. Put ten passages on the table, and open the map and the timeline. Pan,
   and drag a card for five seconds. Note the numbers.
3. Say whether the card falls behind the finger.

## 3. Hands (20 minutes)

Select Record on the touch page (`table /touch`) for any step that feels
wrong, and save the file. Copy it to `test/recordings/` on the Mac.

1. **Palm.** Rest the side of your hand on the panel while you drag a card
   with the other hand. The card must not jump. On the touch page, the palm's
   rings are dashed and **Palm touches** counts them.
2. **Fingers.** Pinch and turn a card with two fingers, fast and slow. Put
   three fingers on a card. Pan the empty table with one and with two
   fingers.
3. **Pull out.** Drag a search result sideways onto the table. Scroll the
   results up and down with one finger. Neither must do the other.
4. **Highlight.** Hold a card with one hand and mark words with the other.
   Mark again to remove. Draw a link to another card.
5. **Taps.** Tap a name (a person or a place), a plain word, and a verse.
   Each must open the right view, and no tap may move the card.
6. **Keyboard.** Tap the search field. Type `jn 3:16` on the on-screen
   keyboard, then Search, then Done.
7. **Reach.** At the 15° angle, note which parts of the screen are hard to
   reach or to see: the top corners, the timeline at the bottom.

## After

Send the notes and the recordings. Each failure becomes a fix, and each
recording becomes a test case in `test/replay.test.js` and
`test/palm.test.js`.
