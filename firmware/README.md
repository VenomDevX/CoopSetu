# CoopSetu attendance terminal — firmware

Two sketches, one per board, from the wiring in [`../Hardware.md`](../Hardware.md).

| Sketch | Board | Does |
|---|---|---|
| `CoopSetuTerminal/` | ESP32 38-pin devkit | TFT UI, touch, PN532 NFC, LEDs, buzzer, button, Wi-Fi, posts attendance |
| `CoopSetuCam/` | AI-Thinker ESP32-CAM | QR decoding and on-device face recognition, over UART |

**None of this has been run on hardware.** It was written against the datasheets
and your pin map, and it compiles nowhere in this repo — there is no ESP32
toolchain here. Treat the first power-up as bring-up, not as a smoke test, and
work through the checklist at the bottom.

---

## Read this before wiring

### 1. Two resistors in the parts list are wrong

`Hardware.md` says so itself, and it matters more than it looks:

- **Button pull-up: fit 10 kΩ, not 200 Ω.** GPIO34 is input-only with *no*
  internal pull-up, so this resistor is the only thing holding the pin high.
  At 200 Ω, every button press sinks 3.3 V / 200 Ω ≈ **16 mA** — near the
  ESP32's ~12 mA continuous per-pin rating, and pure waste.
- **LED resistors: fit 220 Ω, not 200 Ω.** Less critical (≈7 mA vs ≈6 mA), but
  use the specified part.

### 2. The ESP32-CAM's UART pins are its programming pins

`Hardware.md` wires CAM `GPIO1`/`GPIO3` to the terminal's `GPIO16`/`GPIO17`.
Those are `U0TXD`/`U0RXD` — the same pins the USB-serial adapter uses. So:

- **Disconnect both wires before flashing the CAM**, every time.
- The CAM cannot print debug output. `Serial` *is* the link; anything printed
  becomes protocol noise. That is why the sketch reports problems as `ERR`
  frames instead.
- The CAM's ROM bootloader dumps boot chatter into the terminal on every reset.
  Handled: `protocol.h` frames every message with a start marker and an XOR
  checksum, and drops anything that fails to parse.

### 3. The shared SPI bus has a bit-order conflict

`GPIO18/23/19` carry the ILI9341, its XPT2046 touch controller, the TFT's unused
microSD slot, and the PN532. The PN532 clocks SPI **LSB-first**; everything else
is **MSB-first**.

This only works because all three libraries pinned below wrap their transfers in
`SPI.beginTransaction()` / `endTransaction()`, which re-applies bit order and
clock per transaction. **If you swap a library, check that first.** The failure
mode is intermittent corruption that looks exactly like bad soldering.

Also: the TFT's microSD `CS` (GPIO26) is driven **HIGH at boot and never
touched**. A floating SD `CS` lets the card drive MISO and corrupt every other
transfer on the bus.

### 4. The buzzer may need a driver

`GPIO32` → buzzer `+` is only safe for a **low-current 3.3 V active** buzzer.
A 5 V or higher-current one needs a transistor/MOSFET. If yours is *passive*
(needs a tone, not a DC level), set `BUZZER_IS_PASSIVE 1` in `config.h`.

---

## Arduino IDE setup

### Board core — version matters

**Install arduino-esp32 `2.0.17`. Not 3.x.**

The face recogniser (`face_recognition_112_v1_s8`) is an ESP-DL model bundled
with the 2.0.x core. It was **removed in 3.x**, so `CoopSetuCam` will not compile
there. This is the single most likely reason your first build fails.

Boards Manager URL:
`https://espressif.github.io/arduino-esp32/package_esp32_index.json`

| | `CoopSetuTerminal` | `CoopSetuCam` |
|---|---|---|
| Board | ESP32 Dev Module | AI Thinker ESP32-CAM |
| PSRAM | Disabled | **Enabled** (required) |
| Partition | Default 4MB | **Huge APP (3MB)** |
| Upload speed | 921600 | 115200 |

`CoopSetuCam` needs PSRAM for both paths — quirc allocates a full-frame buffer,
and the recognition model does not fit in internal RAM.

### Libraries

| Library | Version | Used by |
|---|---|---|
| Adafruit GFX Library | 1.11.9 | terminal |
| Adafruit ILI9341 | 1.6.0 | terminal |
| XPT2046_Touchscreen | 1.4 | terminal |
| Adafruit PN532 | 1.3.3 | terminal |
| ArduinoJson | 6.21.5 | terminal |
| ESP32QRCodeReader | 0.2.1 | **cam** — for its bundled `quirc` |

`CoopSetuCam` includes `quirc.h` directly rather than using
`ESP32QRCodeReader`'s wrapper, because the sketch has to own the camera
lifecycle to share it between QR and face modes. Install the library anyway —
it is where `quirc` comes from.

---

## Configure

Everything site-specific is in `CoopSetuTerminal/config.h`:

```c
#define WIFI_SSID        "..."
#define WIFI_PASSWORD    "..."
#define API_BASE_URL     "http://192.168.1.10:3000"   // no trailing slash
#define API_DEVICE_TOKEN "..."
```

Then calibrate the touchscreen once: set `TOUCH_CALIBRATION_MODE 1`, flash, tap
each corner, copy the raw values from the serial monitor into `TOUCH_RAW_*`, set
the flag back to `0`.

---

## How it is used

1. **Arm** — the trainer opens the session QR on the CoopSetu dashboard and
   holds it to the camera. The terminal stores the `qr_token` (long-press the
   button to re-arm later).
2. **Identify** — a trainee taps an NFC card, or presses the button for face
   check-in.
3. **Submit** — `POST /api/v1/attendance/qr { qr_token, trainee_id }`.

One session token, many trainees — which is exactly the shape
`app/api/v1/attendance/qr/route.ts` already expects.

### Binding faces and cards to trainees

Over the serial monitor at 115200:

```
enrol 0 3f8c1e22-...    bind slot 0 to a trainee, then capture the face
forget 0                clear slot 0   (255 clears every slot)
session                 re-arm the session QR
status                  print Wi-Fi/CAM/session state and the slot map
```

NFC cards carry the trainee UUID in a single NDEF **Text** record; the terminal
falls back to showing the card UID if the card is blank, so you can see which
card needs writing.

---

## Backend work required — the terminal cannot post attendance yet

Two blockers, both on the server side. The firmware is written to work the
moment they are addressed; neither needs a firmware change.

### Blocker 1 — the endpoint has no device authentication

`app/api/v1/attendance/qr/route.ts` authenticates with `createClient()`, which
reads a **cookie session belonging to a signed-in human**. A wall-mounted
terminal has no cookie, so its requests are rejected today.

It sends `Authorization: Bearer <API_DEVICE_TOKEN>` already. The server needs a
matching guard — a device-token check that resolves to a service-role client for
this route only.

### Blocker 2 — ESP32 face embeddings are not compatible with the schema

This one is architectural, so it is worth being precise:

- `services/attendance.service.ts:165` requires a **128-dimensional float**
  vector and compares with Euclidean distance at threshold 0.6 — that is the
  **face-api.js** format, which is what the web app produces.
- ESP-DL on the ESP32-CAM produces a **512-dimensional int8** vector. Different
  dimensionality, different scale, different metric. There is no conversion
  between them; the two models simply do not share an embedding space.

So the terminal **cannot** populate `trainees.face_embedding`, and a face
enrolled on the web app will never match one enrolled on the device.

The firmware therefore does recognition **entirely on the CAM**: faces are
enrolled into the recogniser's own flash store, and the terminal maps a slot
number to a trainee id. `POST /attendance/qr` then receives a normal
`trainee_id`, so the server sees an ordinary QR check-in.

If you want device faces in the database, the options are:

1. **Keep it on-device** (what this does) — no schema change, but device and web
   face enrolment stay separate.
2. **Add a second column** (`face_embedding_esp` + its own threshold) — device
   and web each match against their own.
3. **Upload the JPEG** and embed server-side with face-api.js — one embedding
   space, at the cost of a new endpoint, more Wi-Fi traffic, and latency.

I would take (1) until there is a reason not to. Option (3) sounds cleanest but
puts a face image on the network for every check-in.

---

## Bring-up checklist

Do these in order. Each isolates one subsystem, so a failure points at one thing.

1. **Power only.** 5 V across VIN/GND. Confirm 3.3 V on the ESP32's 3V3 pin.
   Nothing else connected.
2. **LEDs + buzzer.** Flash the terminal sketch. You should get a boot chirp and
   both LEDs. Wrong LED = swapped GPIO21/22.
3. **Display.** The boot screen should read `COOPSETU`. A white screen is almost
   always `RESET`/`D/C`; a mirrored one is `TFT_ROTATION`.
4. **Touch.** Run `TOUCH_CALIBRATION_MODE`. No output means `T_CS` (GPIO14) or
   `T_IRQ` (GPIO25).
5. **PN532.** Serial prints a firmware version, or the sketch says it is missing.
   If missing: check the board's **DIP switches are set to SPI** — the switches
   decide the interface, not the firmware.
6. **CAM alone.** Flash `CoopSetuCam` **with GPIO1/GPIO3 disconnected**. Reconnect
   after.
7. **Link.** `status` on the terminal's serial monitor should show `cam=1`.
8. **QR.** Long-press the button, show any QR code. The terminal should report
   it as armed.
9. **Face.** `enrol 0 <uuid>`, look at the camera, then press the button.
10. **Attendance.** Only works once the two backend blockers above are resolved.

## Known gaps

- No microSD, so nothing is queued offline — a check-in during a Wi-Fi outage is
  lost. `Hardware.md` notes no SD module is in the project; the TFT's slot is
  wired but deliberately unused (its `CS` is parked HIGH).
- `API_TLS_INSECURE` defaults to `true` for LAN testing. It accepts **any**
  certificate — anything on the path can read and rewrite attendance traffic.
  Set it `false` before this leaves a bench.
- The 3.3 V regulator load has not been checked with the TFT backlight, PN532
  and Wi-Fi all active. Many devkit regulators are marginal at that combination.
