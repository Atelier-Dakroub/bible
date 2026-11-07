# Touch setup

macOS does not give Chrome multi-touch input from a touchscreen. This setup
sends the panel's USB touch device to a Linux VM in UTM. Chrome in the VM then
receives real touch events.

The panel: Prechen 32", 4K, 10 touch points, on a stand at 15 degrees. Its
touch controller is an ILITEK `222A:0001`.

The tested setup: UTM on the QEMU backend, Fedora 44 for ARM64, Google Chrome,
and the `cage` compositor. All 10 touch points work.

## 1. Make the VM

1. In UTM, select **Create a New Virtual Machine**, then **Virtualize**, then
   **Linux**.
2. Do not select **Use Apple Virtualization**. That backend has no USB
   pass-through. The QEMU backend has it.
3. Use a current ARM64 desktop ISO, such as Fedora.
4. Before the first boot, open the VM settings:
   - **Input**: set **USB Sharing** on, and set USB support to **USB 3.0 (XHCI)**.
   - **Display**: select a `virtio-gpu-gl` card if UTM offers it.
5. Install Linux, then install Chrome (or Chromium), `cage` and `wlr-randr`:
   ```sh
   sudo dnf install cage wlr-randr
   ```
6. Copy [`tools/vm/table`](../tools/vm/table) to `~/bin/table` in the VM. It
   starts Chrome in `cage` at the panel's native resolution.

## 2. Connect the panel

1. Connect the panel's video cable and its USB touch cable to the Mac.
2. Start the VM. In the UTM toolbar, open the USB menu and select
   `ILITEK-TOUCH`. macOS releases the device and the VM receives it.
3. Move the UTM window to the panel and make it full screen.

The VM display must cover all of the panel. Linux maps the touch device's full
range to the full VM screen, so a window that covers part of the panel puts
each touch in the wrong place.

## 3. Do not use the COSMIC desktop for touch

COSMIC 1.10 (`cosmic-comp`) opens the touch device and receives its events,
but it sends none of them to the desktop or to applications. Touch does
nothing in COSMIC and nothing in Chrome under COSMIC.

`cage` avoids this. It is a small Wayland compositor that runs one application
full screen and sends all touch input to it. That is also the right shape for
a dedicated table.

## 4. Start Chrome in cage

On the Mac, in this project:

```sh
npm run dev
```

In the VM, the Mac is the gateway of UTM's shared network, usually
`192.168.64.1`. `ip route | grep default` shows it.

1. In a terminal on the desktop, switch to text screen 3:
   ```sh
   sudo chvt 3
   ```
2. At the `login:` prompt, log in.
3. Start the table:
   ```sh
   table
   ```
   `table` opens `/table` on the Mac's dev server. `table /touch` opens the
   touch test, and a full URL opens any address. `cage` and Chrome write their
   messages to `~/.cache/table.log`, not to the screen.
4. Alt + F4 (Option + F4 on a Mac keyboard) closes Chrome, and `cage` exits.
5. `sudo chvt 2 && exit` goes back to the desktop and logs out of the text
   console.

If the keyboard does nothing on a text console after `cage` ends, `cage` left
the console's keyboard switched off. The script switches it back on after a
normal exit. If it still happens, close that session from another machine:
`loginctl list-sessions` shows its number, and `loginctl terminate-session
<number>` closes it and restores the keyboard.

What the script does, and why:

- **It switches the console's keyboard back on when `cage` ends.** A
  compositor that ends badly can leave it off, and then no key works.

- **It sets the display to 3840 × 2160.** UTM's automatic resize can leave the
  VM's preferred mode smaller than the panel, for example 3840 × 2020. UTM then
  centers the picture between black bars, and touches near the top and bottom
  land off by up to the height of a bar. `TABLE_MODE` and `TABLE_OUTPUT`
  change the mode and the output name.
- **`WLR_NO_HARDWARE_CURSORS=1`**: without it, the cursor is drawn upside
  down. This makes `cage` draw the cursor itself.
- **`--user-data-dir`**: without it, an instance of Chrome that already runs
  on the desktop receives the page, and the page opens there, not in `cage`.
- **`--ozone-platform=wayland`**: Chrome talks to `cage` directly, with no X11
  layer between them.

## 5. What to check

| Check | How | A good result |
| --- | --- | --- |
| Touch points | Put ten fingers down | **Most at one time** shows 10 |
| Pointer type | Touch anything | **Pointer type** shows `touch`, not `mouse` |
| Contact size | Touch with a fingertip, then with the flat of a finger | **Contact size** shows Reported, with more than one size. This panel shows "Fixed at 50 × 50". |
| Screen mapping | Touch the center of each crosshair several times | Each offset is less than about 10 px |
| Input rate | Move one finger steadily | **Input samples** shows 60 per second or more |
| Gestures | Move, turn and scale the two cards | The card stays under the fingers |

If all five crosshairs show about the same large offset, the VM screen does
not cover the full panel. Go back to step 2.3. If the offsets in Y are large at
the top and small at the bottom, the picture has black bars: the **Screen** line
then shows less than the panel's resolution.

Contact size decides whether the app can reject a resting palm. The size counts
only when it changes with the contact. The ILITEK panel has no contact axes, and
Chrome reports a fixed 50 × 50 for every touch, so this panel gives no size.
Palm rejection must use a different method, such as the shape of the contact
group or a touch that stays still while others move.

## 6. Record a session

Select **Record**, do the gestures, then select **Save**. Chrome saves a JSON
file with every pointer sample. Copy it to the Mac and keep it in
`test/recordings/`. Recordings from the real panel become the input for the
gesture tests.

## Diagnosis

Each layer of the touch path can be checked on its own. Go from the bottom up.

| Layer | Check |
| --- | --- |
| macOS releases the device | `ioreg -p IOUSB -l -w0 \| grep -A40 ILITEK-TOUCH@ \| grep UsbExclusiveOwner` shows UTM |
| The VM sees the device | `cat /sys/bus/usb/devices/*/product` lists `ILITEK-TOUCH` |
| The driver owns it | `/sys/bus/hid/devices/0003:222A:0001.*/driver` points to `hid-multitouch` |
| Reports cross the USB redirect | The `xhci_hcd` line for the panel's controller in `/proc/interrupts` rises while you touch |
| The kernel emits touches | `libinput debug-events --device /dev/input/event2` prints `TOUCH_DOWN` |
| The compositor forwards them | The touch test page shows `touch` as the pointer type |

`libinput` needs read access to `/dev/input`. Add your account to the `input`
group (`sudo usermod -aG input $USER`, then log in again) so it runs without
`sudo`.

The UTM guest agent (`utmctl exec`) runs as root, but Fedora's SELinux policy
stops it from reading input devices. Use SSH for these checks.

Two numbers from the panel are wrong, and the app must not trust them. The
kernel reports the panel as 310 × 175 mm, but the real panel is about
700 × 394 mm. Both axes have the same range, 0 to 9600, so the touch
resolution is not the same horizontally and vertically. For text at a real
physical size, the app needs its own setting for the screen size.
