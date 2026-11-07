# Touch setup

macOS does not give Chrome multi-touch input from a touchscreen. This setup
sends the panel's USB touch device to a Linux VM in UTM. Chromium in the VM
then receives real touch events.

The panel: Prechen 32", 4K, 10 touch points, on a stand at 15 degrees.

## 1. Make the VM

1. In UTM, select **Create a New Virtual Machine**, then **Virtualize**, then
   **Linux**.
2. Do not select **Use Apple Virtualization**. That backend has no USB
   pass-through. The QEMU backend has it.
3. Use a current ARM64 desktop ISO: Ubuntu Desktop or Fedora Workstation.
4. Before the first boot, open the VM settings:
   - **Input**: set **USB Sharing** on, and set USB support to **USB 3.0 (XHCI)**.
   - **Display**: select a `virtio-gpu-gl` card if UTM offers it.
5. Install Linux, then install Chromium:
   - Ubuntu: `sudo snap install chromium`
   - Fedora: `sudo dnf install chromium`

## 2. Connect the panel

1. Connect the panel's video cable and its USB touch cable to the Mac.
2. Start the VM. In the UTM toolbar, open the USB menu and select the touch
   device. macOS releases the device and the VM receives it.
3. Move the UTM window to the panel and make it full screen.

The VM display must cover all of the panel. Linux maps the touch device's full
range to the full VM screen, so a window that covers part of the panel puts
each touch in the wrong place. The resolution itself does not matter, only the
coverage.

## 3. Check the driver

In a terminal in the VM:

```sh
sudo libinput list-devices      # the panel must show the capability "touch"
sudo libinput debug-events      # put ten fingers down: slots 0 to 9 must show
```

If the panel is not in the list, look for the driver messages:

```sh
sudo dmesg | grep -i -E 'hid|multitouch'
```

## 4. Open the test page

On the Mac, in this project:

```sh
npm run dev
```

The VM reaches the Mac through the gateway of UTM's shared network. Find its
address in the VM:

```sh
ip route | grep default         # "default via 192.168.64.1 ..." — use that address
```

Then open `http://<that address>:1960/touch` in Chromium. If macOS asks
whether `node` can accept connections, allow it. For a screen with no browser
chrome, start Chromium in kiosk mode:

```sh
chromium --kiosk http://192.168.64.1:1960/touch
```

## 5. What to check

| Check | How | A good result |
| --- | --- | --- |
| Touch points | Put ten fingers down | **Most at one time** shows 10 |
| Pointer type | Touch anything | **Pointer type** shows `touch`, not `mouse` |
| Contact size | Touch with a fingertip, then with the flat of a finger | **Contact size** shows Reported, and the rings change size |
| Screen mapping | Touch the center of each crosshair several times | Each offset is less than about 10 px |
| Input rate | Move one finger steadily | **Input samples** shows 60 per second or more |
| Gestures | Move, turn and scale the two cards | The card stays under the fingers |

If all five crosshairs show about the same large offset, the VM screen does
not cover the full panel. Go back to step 2.3.

Contact size decides whether the app can reject a resting palm. A panel that
reports 1 × 1 for every touch gives no size, and palm rejection then needs a
different method.

## 6. Record a session

Select **Record**, do the gestures, then select **Save**. Chromium saves a JSON
file with every pointer sample. Copy it to the Mac and keep it in
`test/recordings/`. Recordings from the real panel become the input for the
gesture tests.
