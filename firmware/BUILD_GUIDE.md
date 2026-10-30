# CoopSetu Attendance Terminal — Complete Build Guide

Everything needed to go from loose parts to a working terminal: wiring, every
connection, software setup, flashing, configuration, and testing.

> **Read this first.** None of this firmware has been run on hardware — there
> was no board available when it was written. It was built from datasheets and
> the pin map in [`../Hardware.md`](../Hardware.md). Follow the stages in order;
> each one isolates a single subsystem so that when something fails you know
> exactly what to blame. Do not wire everything and hope.

**Estimated time:** 3–5 hours end to end, including flashing and testing.

---

## Table of contents

1. [Parts and tools](#1-parts-and-tools)
2. [Before you solder: three things that will bite you](#2-before-you-solder-three-things-that-will-bite-you)
3. [Wiring, stage by stage](#3-wiring-stage-by-stage)
4. [Complete connection reference](#4-complete-connection-reference)
5. [Software setup](#5-software-setup)
6. [Configuring the firmware](#6-configuring-the-firmware)
7. [Flashing both boards](#7-flashing-both-boards)
8. [Calibrating the touchscreen](#8-calibrating-the-touchscreen)
9. [Bring-up: testing each subsystem](#9-bring-up-testing-each-subsystem)
10. [Provisioning cards and faces](#10-provisioning-cards-and-faces)
11. [Daily operation](#11-daily-operation)
12. [Troubleshooting](#12-troubleshooting)
13. [Backend work still required](#13-backend-work-still-required)

---

## 1. Parts and tools

### Components

| # | Part | Notes |
|---|---|---|
| 1 | ESP32 devkit, 38-pin | The main controller |
| 2 | ESP32-CAM (AI-Thinker) | Camera + face/QR processing |
| 3 | PN532 NFC module | **Must support SPI mode** — check it has DIP switches |
| 4 | ILI9341 2.8" TFT with touch | The version with `T_CS`/`T_IRQ` pins |
| 5 | Buzzer | See the note below — active vs passive matters |
| 6 | Pushbutton | Momentary, normally-open |
| 7 | 5 V DC supply | **2 A minimum**; see §2.3 |
| 8 | Jumper wire × 1 | Button uses GPIO33's internal pull-up |
| 9 | 220 Ω resistor × 2 | LED current limiting |
| 10 | Green LED × 1 | |
| 11 | Red LED × 1 | |
| 12 | USB-to-serial adapter (FTDI/CP2102) | **Required** to flash the ESP32-CAM |
| 13 | NTAG213/215/216 cards or tags | Demo/standard use; terminal provisions a CS1 credential |
| 14 | MIFARE DESFire EV2/EV3 cards | Required where cryptographic anti-cloning is mandatory |

### ⚠️ Three parts to double-check before you start

**Do not use the stored 200 Ω part as a button pull-up.** The button now uses
GPIO33 with the ESP32's internal pull-up, so it needs only a wire to ground.

**The LED resistors must be 220 Ω.** Also recorded as 200 Ω. Less serious
(≈7 mA vs ≈6 mA) but use the right part.

**Check whether your buzzer is active or passive.** An *active* buzzer makes a
tone from a DC voltage. A *passive* one needs an oscillating signal. Test it with
a 3 V coin cell: if it beeps, it's active. If it clicks once, it's passive — set
`BUZZER_IS_PASSIVE 1` in `config.h`. If it's rated 5 V or draws more than ~12 mA,
**do not wire it straight to GPIO32** — you need a transistor or MOSFET driver.

### Tools

- Soldering iron and solder
- Breadboard (for stage 1 testing) and/or perfboard for the final build
- Jumper wires — male-to-female and male-to-male
- **Multimeter** — not optional; you need it for §3.1
- Small flat screwdriver for the PN532's DIP switches

---

## 2. Before you solder: three things that will bite you

These aren't general advice. They're specific consequences of *your* pin map.

### 2.1 The ESP32-CAM's UART pins are its programming pins

`Hardware.md` connects CAM `GPIO1` and `GPIO3` to the terminal. Those are
`U0TXD` and `U0RXD` — the same pins a USB-serial adapter uses to flash the board.

Three consequences you cannot design around:

- **You must physically disconnect both wires every time you flash the CAM.**
  Leave them attached and the flash will fail, or worse, half-succeed.
- **The CAM can never print debug output.** `Serial` *is* the link to the
  terminal. Anything printed becomes protocol noise. This is why the firmware
  reports problems as `ERR` frames instead of `Serial.println`.
- **Every CAM reset dumps bootloader chatter into the terminal.** Handled in
  firmware: every message is wrapped as `#<body>*<checksum>\n` and anything that
  fails to parse is silently dropped.

**Recommendation:** put a 2-pin header or a jumper on those two wires so you can
disconnect them without desoldering. You will do this more often than you expect.

### 2.2 Three devices share one SPI bus, and one of them is backwards

`GPIO18` (clock), `GPIO23` (MOSI) and `GPIO19` (MISO) are shared by:

- the ILI9341 display
- its XPT2046 touch controller
- the display's on-board microSD slot (unused)
- the PN532

The PN532 clocks SPI **LSB-first**. Everything else is **MSB-first**.

This works only because every library listed in §5.2 wraps its transfers in
`SPI.beginTransaction()` / `endTransaction()`, which re-applies bit order and
clock speed per transaction. **If you substitute a library, verify that first.**
The failure mode is intermittent corruption that looks exactly like a bad solder
joint, and you will spend hours reflowing joints that were fine.

The display's unused microSD `CS` (GPIO26) is driven **HIGH at boot and never
touched again**. A floating SD `CS` lets the card drive the MISO line and corrupt
every other transfer on the bus. This is already handled in `display.cpp` — just
don't remove that wire.

### 2.3 Power budget

Rough worst case with everything active:

| Load | Current |
|---|---|
| ESP32 with Wi-Fi transmitting | ~250 mA peak |
| ESP32-CAM during face inference | ~200 mA, peaks to 300 mA |
| TFT with backlight | ~100 mA |
| PN532 polling | ~100 mA |
| LEDs + buzzer | ~30 mA |
| **Total peak** | **~900 mA** |

Use a **2 A supply**. A 1 A phone charger will appear to work and then brown out
during the first Wi-Fi transmit that coincides with a camera frame — which
presents as random reboots that are very hard to diagnose.

Note also that the TFT, touch, and PN532 all run from the ESP32 devkit's
**on-board 3.3 V regulator**, which is often only rated 500–800 mA. This
combination has not been measured. If you see instability under load, power the
3.3 V rail from a separate regulator instead.

---

## 3. Wiring, stage by stage

Build in this order. Power up and test at each checkpoint. Do not skip ahead —
if you wire everything at once and it doesn't work, you have 40+ connections to
suspect.

### Stage 3.1 — Power only

Wire nothing but power.

| From | To |
|---|---|
| 5 V supply **+** | ESP32 `VIN` |
| 5 V supply **−** | ESP32 `GND` |

**✅ Checkpoint:** power on. Measure with a multimeter between the ESP32's `3V3`
and `GND` pins. **You must read 3.2–3.4 V.**

If you read 0 V or something under 3 V, stop. Check supply polarity — reversed
power will destroy the board. Do not continue until this reads correctly.

Power off before continuing. **Power off before every wiring change**, throughout.

### Stage 3.2 — Ground and 3.3 V rails

Build the two rails everything else hangs off. Use a breadboard rail or a solder
bus — do not daisy-chain grounds through modules.

**Ground — connect all of these to ESP32 `GND`:**

| Device | Pin |
|---|---|
| ESP32-CAM | `GND` |
| ILI9341 | `GND` |
| PN532 | `GND` |
| Buzzer | `−` |
| Pushbutton | pin 2 |
| Green LED | cathode (short leg) |
| Red LED | cathode (short leg) |

**3.3 V — connect all of these to ESP32 `3V3`:**

| Device | Pin |
|---|---|
| ILI9341 | `VCC` |
| ILI9341 | `LED` (backlight) |
| PN532 | `VCC` |

> The ESP32-CAM is the exception: it takes **5 V** from the supply directly, not
> 3.3 V from the ESP32. Its own regulator handles the rest.

| From | To |
|---|---|
| 5 V supply **+** | ESP32-CAM `5V` |

**✅ Checkpoint:** power on. Confirm 3.3 V at the ILI9341's `VCC` pin and at the
PN532's `VCC` pin, measured against ground. Confirm 5 V at the CAM's `5V` pin.

### Stage 3.3 — LEDs and buzzer

The two LEDs, each through its own 220 Ω resistor.

**Green LED:**

| From | To |
|---|---|
| ESP32 `GPIO21` | 220 Ω resistor, leg 1 |
| 220 Ω resistor, leg 2 | Green LED **anode** (long leg) |
| Green LED **cathode** (short leg) | `GND` |

**Red LED:**

| From | To |
|---|---|
| ESP32 `GPIO22` | 220 Ω resistor, leg 1 |
| 220 Ω resistor, leg 2 | Red LED **anode** (long leg) |
| Red LED **cathode** (short leg) | `GND` |

**Buzzer:**

| From | To |
|---|---|
| ESP32 `GPIO32` | 1 kΩ resistor → transistor gate/base |
| Transistor source/emitter | `GND` |
| Transistor drain/collector | Buzzer `−` |
| Buzzer `+` | Buzzer-rated supply |

Fit a reverse-biased flyback diode across a magnetic buzzer. Do not connect the
buzzer load directly to GPIO32.

> LEDs are polarised. Long leg = anode = toward the resistor. Backwards, they
> simply don't light — no damage, but easy to miss.

**✅ Checkpoint:** tested in §9, step 2, after the first flash.

### Stage 3.4 — Pushbutton

GPIO33 supports the internal pull-up enabled by the firmware.

| From | To |
|---|---|
| ESP32 `GPIO33` | Pushbutton pin 1 |
| Pushbutton pin 2 | `GND` |

Electrically: `GPIO33 → button → GND`. The internal pull-up holds GPIO33 high;
pressed, the button pulls it low (`BUTTON_ACTIVE_LOW 1`).

> A 4-pin tactile switch has pins connected in pairs. If the button seems always
> pressed, you've used two pins from the same pair — rotate it 90°.

**✅ Checkpoint:** with power on, measure GPIO33 against ground. **3.3 V idle,
0 V pressed.** If it does not change, check the button orientation and wiring.

### Stage 3.5 — The shared SPI bus

Three lines fan out to several devices. Keep these wires **short** — under 10 cm
if you can. Long SPI wires on a breadboard cause exactly the intermittent
glitches described in §2.2.

| ESP32 pin | Goes to |
|---|---|
| `GPIO18` (clock) | TFT `SCK`, TFT `SD_SCK`, TFT `T_CLK`, PN532 `SCK` |
| `GPIO23` (MOSI) | TFT `SDI(MOSI)`, TFT `SD_MOSI`, TFT `T_DIN`, PN532 `MOSI` |
| `GPIO19` (MISO) | TFT `SDO(MISO)`, TFT `SD_MISO`, TFT `T_DO`, PN532 `MISO` |

### Stage 3.6 — ILI9341 display and touch

Chip selects and control lines — these are what distinguish the devices on the
shared bus.

| ILI9341 pin | ESP32 pin | Purpose |
|---|---|---|
| `CS` | `GPIO5` | Display chip select |
| `D/C` | `GPIO27` | Data/command |
| `RESET` | `GPIO4` | Display reset |
| `T_CS` | `GPIO14` | Touch chip select |
| `T_IRQ` | `GPIO25` | Touch interrupt |
| `SD_CS` | `GPIO26` | microSD select — **unused but must be wired** |

> **Do not omit `SD_CS`.** The project uses no SD card, but if that pin floats
> the card slot can drive the shared MISO line and corrupt every transfer.
> `display.cpp` parks it HIGH at boot specifically to prevent this.

Plus, already done in stage 3.2: `VCC` → 3.3 V, `LED` → 3.3 V, `GND` → GND.

### Stage 3.7 — PN532 NFC

**First: set the DIP switches to SPI mode.** The PN532's interface is chosen by
two small switches on the board, **not by firmware**. Almost every "PN532 not
found" report is this.

| Mode | SW1 | SW2 |
|---|---|---|
| **SPI** ← use this | **OFF** | **ON** |
| I²C | ON | OFF |
| HSU/UART | OFF | OFF |

Some boards label these `0`/`1` instead of OFF/ON — check the silkscreen next to
the switches.

| PN532 pin | ESP32 pin |
|---|---|
| `SCK` | `GPIO18` (shared) |
| `MOSI` | `GPIO23` (shared) |
| `MISO` | `GPIO19` (shared) |
| `SS`/`SSEL` | `GPIO13` |
| `VCC` | 3.3 V |
| `GND` | GND |

`IRQ`, `RSTO`, `SDA`/`TXD` and `SCL`/`RXD` are **left unconnected** — the
firmware polls rather than using interrupts.

### Stage 3.8 — UART link to the ESP32-CAM

Note the crossover: transmit goes to receive.

| ESP32 pin | Direction | ESP32-CAM pin |
|---|---|---|
| `GPIO16` (RX2) | ← receives from | `GPIO1` (U0TXD) |
| `GPIO17` (TX2) | → transmits to | `GPIO3` (U0RXD) |
| `GND` | ↔ | `GND` |

Both boards run at 3.3 V logic, so no level shifting is needed.

> **Fit a jumper or removable header here.** Per §2.1 you must disconnect both
> wires every time you reflash the CAM.

**✅ Wiring complete.** Recheck every connection against §4 before powering on.

---

## 4. Complete connection reference

Every connection in the build, in one table. Use this to verify.

### Power

| From | To |
|---|---|
| 5 V supply + | ESP32 `VIN` |
| 5 V supply + | ESP32-CAM `5V` |
| 5 V supply − | ESP32 `GND` |

### Ground (all to ESP32 `GND`)

`ESP32-CAM GND` · `ILI9341 GND` · `PN532 GND` · `Buzzer −` · `Pushbutton pin 2` ·
`Green LED cathode` · `Red LED cathode`

### 3.3 V (all from ESP32 `3V3`)

`ILI9341 VCC` · `ILI9341 LED` · `PN532 VCC` · `10 kΩ pull-up pin 2`

### GPIO assignments

| GPIO | Connects to | Direction | Notes |
|---|---|---|---|
| 4 | ILI9341 `RESET` | out | |
| 5 | ILI9341 `CS` | out | Strapping pin; idles high, safe |
| 13 | PN532 `SS` | out | |
| 14 | ILI9341 `T_CS` | out | Touch select |
| 16 | ESP32-CAM `GPIO1` | **in** | RX2 |
| 17 | ESP32-CAM `GPIO3` | out | TX2 |
| 18 | TFT `SCK` + `SD_SCK` + `T_CLK`, PN532 `SCK` | out | Shared clock |
| 19 | TFT `MISO` + `SD_MISO` + `T_DO`, PN532 `MISO` | **in** | Shared |
| 21 | 220 Ω → Green LED anode | out | |
| 22 | 220 Ω → Red LED anode | out | |
| 23 | TFT `MOSI` + `SD_MOSI` + `T_DIN`, PN532 `MOSI` | out | Shared |
| 25 | ILI9341 `T_IRQ` | **in** | Touch interrupt |
| 26 | ILI9341 `SD_CS` | out | Unused; parked HIGH |
| 27 | ILI9341 `D/C` | out | |
| 32 | Buzzer `+` | out | Low-current 3.3 V buzzer only |
| 34 | Pushbutton pin 1, and 10 kΩ to 3.3 V | **in** | Input-only, no internal pull-up |

### Deliberately unconnected

PN532 `IRQ`, `RSTO`, `SDA`/`TXD`, `SCL`/`RXD` — the firmware polls the reader
rather than using interrupts, and resets it over SPI, so none of these are
needed.

In particular there is **no GPIO33 → `RSTO` wire**, which `Hardware.md` calls out
explicitly. That is intentional: `nfcBegin()` resets the PN532 through
`SAMConfig()`. GPIO33 is free for future use.

---

## 5. Software setup

### 5.1 Arduino IDE and the ESP32 core

Install the Arduino IDE (2.x is fine), then add the ESP32 boards package:

1. **File → Preferences → Additional Board Manager URLs**, add:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
2. **Tools → Board → Boards Manager**, search `esp32`.
3. Install **version 2.0.17**.

> ### ⚠️ Install 2.0.17, not 3.x
>
> The face recogniser (`face_recognition_112_v1_s8`) is an ESP-DL model bundled
> with the 2.0.x core. **It was removed in 3.x**, so `CoopSetuCam` will not
> compile there. Errors like `human_face_detect_msr01.hpp: No such file or
> directory` mean you're on 3.x.
>
> If Boards Manager already installed 3.x, use its version dropdown to select
> 2.0.17 and click Install again.

### 5.2 Libraries

**Sketch → Include Library → Manage Libraries**, then install each at the version
shown. Versions are pinned because §2.2 depends on their SPI transaction
behaviour.

| Library | Version | Used by |
|---|---|---|
| Adafruit GFX Library | 1.11.9 | Terminal |
| Adafruit ILI9341 | 1.6.0 | Terminal |
| XPT2046_Touchscreen | 1.4 | Terminal |
| Adafruit PN532 | 1.3.3 | Terminal |
| ArduinoJson | 6.21.5 | Terminal |
| ESP32QRCodeReader | 0.2.1 | **CAM** |

> ArduinoJson **6.x**, not 7.x — the code uses `StaticJsonDocument`, which 7.x
> removed.
>
> `ESP32QRCodeReader` is installed for the `quirc` decoder bundled inside it.
> `CoopSetuCam.ino` includes `quirc.h` directly rather than using that library's
> wrapper, because the sketch has to own the camera lifecycle to share it
> between QR and face modes.

Adafruit libraries will offer to install dependencies — accept.

### 5.3 Board settings

Set these under **Tools** *before* compiling. They differ per sketch, and getting
them wrong is a common cause of a board that flashes but won't boot.

**For `CoopSetuTerminal`:**

| Setting | Value |
|---|---|
| Board | ESP32 Dev Module |
| Upload Speed | 921600 |
| Flash Frequency | 80 MHz |
| Flash Mode | QIO |
| Flash Size | 4 MB (32 Mb) |
| Partition Scheme | Default 4 MB with spiffs |
| PSRAM | Disabled |

**For `CoopSetuCam`:**

| Setting | Value |
|---|---|
| Board | AI Thinker ESP32-CAM |
| Upload Speed | 115200 |
| Flash Frequency | 80 MHz |
| Flash Mode | QIO |
| Partition Scheme | **Huge APP (3 MB No OTA/1 MB SPIFFS)** |
| PSRAM | **Enabled** |

> Both CAM settings are mandatory. **PSRAM Enabled** — quirc needs a full-frame
> buffer and the face model won't fit in internal RAM. **Huge APP** — the
> recognition model makes the binary too large for the default partition, and
> you'll get `Sketch too big`.

---

## 6. Configuring the firmware

Open `firmware/CoopSetuTerminal/config.h` and edit the top section:

```c
#define WIFI_SSID        "YourNetwork"
#define WIFI_PASSWORD    "YourPassword"

// No trailing slash. Must be reachable from the terminal's network —
// the machine running `npm run dev`, or your deployed server.
#define API_BASE_URL     "http://192.168.1.10:3000"

#define API_DEVICE_TOKEN "your-device-token"
```

To find your server's IP: run `npm run dev` and read the `Network:` line it
prints, e.g. `http://192.168.1.10:3000`.

Other settings worth knowing:

| Setting | Default | Meaning |
|---|---|---|
| `BUZZER_IS_PASSIVE` | `0` | Set `1` if your buzzer needs a tone |
| `FACE_MIN_CONFIDENCE` | `0.62` | Raise to reduce false matches |
| `IDENTIFY_TIMEOUT_MS` | `12000` | How long to wait for a face |
| `QR_SESSION_TTL_MS` | 4 hours | Local re-arm prompt |
| `API_TLS_INSECURE` | `true` | **Set `false` before production** — see §13 |

---

## 7. Flashing both boards

### 7.1 The terminal (ESP32 38-pin)

Straightforward — it has USB.

1. Connect the ESP32 by USB.
2. **Tools → Port**, select it.
3. Open `firmware/CoopSetuTerminal/CoopSetuTerminal.ino`.
4. Confirm the board settings from §5.3.
5. Click **Upload**.

If it stalls at `Connecting........`, hold the **BOOT** button while it connects.

### 7.2 The ESP32-CAM — read this carefully

The CAM has no USB. You need a USB-serial adapter, and there's a specific
sequence.

**Step 1 — disconnect the terminal link.** Remove **both** wires between CAM
`GPIO1`/`GPIO3` and the terminal's `GPIO16`/`GPIO17`. Flashing will fail
otherwise. (This is why §3.8 suggested a jumper.)

**Step 2 — wire the adapter.** Set it to **3.3 V**, not 5 V:

| USB-serial adapter | ESP32-CAM |
|---|---|
| `GND` | `GND` |
| `5V` (or `VCC`) | `5V` |
| `TX` | `U0R` (GPIO3) |
| `RX` | `U0T` (GPIO1) |

**Step 3 — enter flash mode.** Connect CAM `GPIO0` to `GND`. A jumper wire is
fine. **The board only enters flash mode with GPIO0 grounded.**

**Step 4 — flash:**

1. With `GPIO0` still grounded, press the CAM's **RESET** button.
2. Open `firmware/CoopSetuCam/CoopSetuCam.ino`.
3. Confirm the CAM board settings from §5.3 — **PSRAM Enabled, Huge APP**.
4. Click **Upload**. Expect 1–3 minutes; the binary is large.

**Step 5 — return to normal mode:**

1. **Remove the `GPIO0` → `GND` jumper.**
2. Press **RESET**.
3. Disconnect the USB-serial adapter.
4. **Reconnect** the two wires to the terminal's `GPIO16`/`GPIO17`.

> Forgetting to remove the GPIO0 jumper is the most common mistake. The board
> silently stays in bootloader mode and never runs your sketch.

---

## 8. Calibrating the touchscreen

Every panel differs. Do this once — no reflashing needed.

1. **Hold the button while powering on** the terminal (or set
   `TOUCH_CALIBRATION_MODE 1` in `config.h` to force it on every boot).
2. Tap the centre of each of the three targets with a stylus.
3. A **Touch test** screen follows: dots should appear right under the stylus.
   Press the button to finish booting.

The result is saved to flash and used on every later boot. Axis swapping and
mirroring are detected automatically. If the taps were too close together it
asks you to repeat them.

The Serial Monitor (115200) also prints the measured values as `config.h`
lines. Copy them in if you want them as the default for a fresh flash:

```c
#define TOUCH_RAW_LEFT   320   // raw value at the left edge
#define TOUCH_RAW_RIGHT  3900  // raw value at the right edge
#define TOUCH_RAW_TOP    300   // raw value at the top edge
#define TOUCH_RAW_BOTTOM 3800  // raw value at the bottom edge
#define TOUCH_SWAP_XY    0
```

---

## 9. Bring-up: testing each subsystem

Do these in order. Each isolates one thing.

| # | Test | Do this | Expect | If it fails |
|---|---|---|---|---|
| 1 | **Power** | Multimeter on `3V3`–`GND` | 3.2–3.4 V | Check polarity — reversed power kills boards |
| 2 | **LEDs + buzzer** | Flash terminal, watch boot | Short chirp, both LEDs flash | Swapped colours = GPIO21/22 reversed; nothing = LED polarity |
| 3 | **Display** | Watch after boot | `COOPSETU` on screen | White screen = `RESET`/`D/C`; blank = backlight `LED` pin |
| 4 | **Touch** | §8 calibration mode | Raw values on serial | Nothing = `T_CS` (GPIO14) or `T_IRQ` (GPIO25) |
| 5 | **PN532** | Watch serial at boot | No "PN532 not found" | **Check the DIP switches are SPI** (§3.7) |
| 6 | **CAM alone** | Flash it, watch its own serial | `#READY*` frame | See §7.2 |
| 7 | **Link** | Type `status` on terminal serial | `cam=1` | Check GPIO16/17 crossover |
| 8 | **QR** | Long-press button, show any QR | "Session armed" | Improve lighting; hold 15–25 cm away |
| 9 | **Face** | `enrol 0 <uuid>`, look at camera | "Face enrolled" | Face the camera squarely, bright even light |
| 10 | **Attendance** | Tap a card | "Marked" | **Blocked** — see §13 |

Step 10 will not pass yet. That's expected, and it isn't a wiring fault — see §13.

---

## 10. Provisioning cards and faces

All administration happens over the terminal's **Serial Monitor at 115200**.

### Commands

| Command | Does |
|---|---|
| `status` | Show Wi-Fi, CAM link, session state, and slot map |
| `enrol <slot> <trainee-uuid>` | Bind a face slot to a trainee, then capture |
| `forget <slot>` | Clear one slot (`255` clears all) |
| `session` | Re-arm the session QR |

### Enrolling a face

1. Get the trainee's UUID from the CoopSetu dashboard.
2. Type: `enrol 0 3f8c1e22-1234-5678-9abc-def012345678`
3. The screen shows "ENROL FACE". Have them look at the camera.
4. Four frames are captured; it reports "Face enrolled".

Slots are `0`–`15`, so **16 faces maximum** per terminal.

### Writing NFC cards

Cards carry the trainee UUID in a single NDEF **Text** record. Use the free
**NFC Tools** app on any Android phone:

1. NFC Tools → **Write** → **Add a record** → **Text**.
2. Paste the trainee's UUID — nothing else.
3. **Write** and hold the card to the phone.

Tap an unwritten card on the terminal and it shows the card's UID with "Card not
linked", so you can identify which card to write.

---

## 11. Daily operation

**Start of a session:**

1. The trainer opens the attendance session on the CoopSetu dashboard, which
   shows a QR code.
2. **Long-press** the terminal's button (about 1.5 s) to enter arm mode.
3. Hold the QR to the camera. The screen confirms "Session armed".

**During the session:**

- **NFC:** the trainee taps their card. Marked automatically.
- **Face:** the trainee presses the button briefly, then looks at the camera.

Green LED + rising beeps = marked. Red LED + a long beep = rejected, with the
reason on screen.

The terminal keeps the session for 4 hours, or until the server says the token
expired — at which point it drops it and asks you to re-arm, rather than failing
every tap identically.

---

## 12. Troubleshooting

### Display

| Symptom | Cause |
|---|---|
| White screen | `RESET` (GPIO4) or `D/C` (GPIO27) miswired |
| Backlight on, nothing drawn | `CS` (GPIO5) or `MOSI` (GPIO23) |
| Nothing at all | `LED` pin not on 3.3 V |
| Mirrored / rotated | Change `TFT_ROTATION` in `config.h` |
| Random flicker or garbage | SPI wires too long, **or** a library not using transactions (§2.2) |

### PN532

| Symptom | Cause |
|---|---|
| "PN532 not found" | **DIP switches not set to SPI** — check this first |
| Found, but cards never read | `SS` (GPIO13) miswired, or the card isn't NTAG21x |
| Works alone, breaks with display | SD `CS` (GPIO26) floating — must be wired and parked HIGH |

### ESP32-CAM

| Symptom | Cause |
|---|---|
| `Failed to connect` when flashing | `GPIO0` not grounded, or RESET not pressed |
| Flashes, then does nothing | `GPIO0` jumper still fitted |
| `Sketch too big` | Partition not set to **Huge APP** |
| `human_face_detect_msr01.hpp: No such file` | **Core 3.x installed — downgrade to 2.0.17** |
| `Camera init failed 0x105` | PSRAM not enabled, or a bad ribbon connection |
| `cam=0` in `status` | GPIO16/17 crossover, or the wires are still disconnected from flashing |

### Attendance

| Symptom | Cause |
|---|---|
| "No Wi-Fi" | Check SSID/password; ESP32 is **2.4 GHz only**, not 5 GHz |
| "QR code has expired" | Re-arm with a fresh QR from the dashboard |
| "Card not linked" | Card has no NDEF text record — see §10 |
| "Unassigned face" | Slot recognised but no trainee bound — run `enrol` |
| HTTP 401 / 403 | **Expected today** — see §13 |

### General

| Symptom | Cause |
|---|---|
| Random reboots | Supply too weak — use 2 A (§2.3) |
| Reboots only during Wi-Fi + camera | Same; brownout under peak load |
| Serial prints garbage | Baud isn't 115200 |

---

## 13. Backend work still required

**The terminal cannot post attendance yet.** This is a server-side gap, not a
wiring or firmware fault, and it's why test 10 in §9 will fail.

`app/api/v1/attendance/qr/route.ts` authenticates with `createClient()`, which
reads a **cookie session belonging to a signed-in human**. A wall-mounted
terminal has no cookie, so its requests are rejected.

The firmware already sends `Authorization: Bearer <API_DEVICE_TOKEN>`. The server
needs a matching device-token guard that resolves to a service-role client for
that route. **No firmware change is needed once it exists.**

### Face embeddings are not interchangeable

Also worth knowing before anyone tries to unify them:

- `services/attendance.service.ts:165` expects a **128-dimensional float**
  embedding — face-api.js, Euclidean distance, threshold 0.6. That's what the
  web app produces.
- ESP-DL on the ESP32-CAM produces a **512-dimensional int8** embedding.

Different dimensionality, scale, and distance metric, with no conversion between
them. **A face enrolled in the web app will never match one enrolled on the
terminal**, and vice versa.

The firmware therefore does recognition entirely on the CAM and maps a local slot
to a trainee id, so the server just sees an ordinary QR check-in. See
`README.md` for the three options if you want device faces in the database.

### Before production

- **Set `API_TLS_INSECURE` to `false`** and use `https://`. At `true` the
  terminal accepts *any* certificate, so anything on the network path can read
  and rewrite attendance traffic.
- Note there's **no offline queue** — a check-in during a Wi-Fi outage is lost.
  `Hardware.md` records no SD module in the project, and the display's slot is
  deliberately unused (§2.2).
