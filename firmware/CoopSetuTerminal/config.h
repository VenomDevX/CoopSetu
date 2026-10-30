// Pin map and site configuration for the CoopSetu attendance terminal
// (ESP32 38-pin devkit). Every pin below is transcribed from Hardware.md.

#ifndef COOPSETU_CONFIG_H
#define COOPSETU_CONFIG_H

#include "protocol.h"  // PROTO_BAUD

#define FIRMWARE_VERSION "2.1.0"

// ---------------------------------------------------------------- Wi-Fi / API
#if __has_include("config.local.h")
#include "config.local.h"
#else
#error "Missing config.local.h; copy config.local.example.h and provision this terminal"
#endif

// Base URL of the CoopSetu server, no trailing slash.
// Must be reachable from the terminal's network. https:// is strongly
// preferred; see API_TLS_INSECURE below before using it.

// Sent as `Authorization: Bearer <token>`.
//
// IMPORTANT: app/api/v1/attendance/qr/route.ts currently authenticates with
// createClient() — a *cookie* session belonging to a signed-in human. A device
// has no cookie, so as of this commit these requests are rejected. The server
// needs a device-token guard before the terminal can post attendance; see
// firmware/README.md ("Backend work required"). The header is sent now so no
// firmware change is needed once that lands.

// Skips certificate validation on https://. Convenient on a LAN with a
// self-signed cert, and unacceptable in production: it accepts any certificate,
// so anything on the path can read and rewrite attendance traffic. Ship false.
#ifndef API_TLS_INSECURE
#define API_TLS_INSECURE 0
#endif
#ifndef API_ALLOW_PLAINTEXT_HTTP
#define API_ALLOW_PLAINTEXT_HTTP 0
#endif
#ifndef API_ROOT_CA
#define API_ROOT_CA ""
#endif

#define HTTP_TIMEOUT_MS  8000

// ------------------------------------------------------------------- Behaviour
#define QR_SESSION_TTL_MS   (4UL * 60UL * 60UL * 1000UL)  // re-arm after 4 h
#define IDENTIFY_TIMEOUT_MS 12000    // give up on a face after this long
#define RESULT_DWELL_MS     2500     // how long a result screen stays up
#define BUTTON_LONG_PRESS_MS 1200    // long press = re-arm session
#define FACE_MIN_CONFIDENCE  0.62f   // reject weaker matches from the CAM

// RFID repeat lockout: the same UID is ignored until the card has been off
// the reader for this long. Only meant to stop a card resting on the reader
// from re-submitting; "already marked" is decided by the server (30 min
// window). A long value here made the terminal ignore a card for minutes
// after a failed attempt (e.g. tapped while Wi-Fi was down).
#define RFID_DEDUPE_MS      2000UL

// ARM screen timeout: if the CAM doesn't respond within this window, show
// "Camera not responding" and auto-pop to Home. Fixes diagnostic #3.
#define ARM_TIMEOUT_MS      20000

// Touch debounce window — the minimum time between successive touch events.
#define TOUCH_DEBOUNCE_MS   40

// Admin PIN for on-device RFID registration (4 digits). Change via the
// serial console: `admin-pin <4digits>`.
#define DEFAULT_ADMIN_PIN   "0000"

// ----------------------------------------------------------------- LEDs/buzzer
#define PIN_LED_GREEN  21
#define PIN_LED_RED    22
#define PIN_BUZZER     32

// GPIO32 drives the transistor/MOSFET input documented in Hardware.md, never
// the buzzer load directly. Set this to 1 for a passive buzzer tone.
#define BUZZER_IS_PASSIVE 0
#define BUZZER_LEDC_CH    0
#define BUZZER_TONE_HZ    2700

// ---------------------------------------------------------------------- Button
// GPIO34 is input-only and has NO internal pull-up, which is why Hardware.md
// specifies an external one. Fit the 10 kΩ it calls for: the 200 Ω part
// currently listed would sink 3.3 V / 200 Ω ≈ 16 mA every time the button is
// held — wasteful, hot, and near the pin's continuous rating.
#define PIN_BUTTON     33
#define BUTTON_ACTIVE_LOW 1

// ------------------------------------------------------------- Shared SPI bus
// VSPI. Hardware.md ties the TFT, its touch controller, the TFT's (unused) SD
// slot and the PN532 to these three lines; only the chip selects differ.
#define PIN_SPI_SCK    18
#define PIN_SPI_MOSI   23
#define PIN_SPI_MISO   19

// ------------------------------------------------------------------- ILI9341
#define PIN_TFT_CS     5
#define PIN_TFT_DC     27
#define PIN_TFT_RST    4
#define PIN_TOUCH_CS   14
#define PIN_TOUCH_IRQ  255  // 255 disables hardware interrupts to prevent SPI bus crashing

// The TFT carries a microSD slot this project does not use. Its select line is
// wired (Hardware.md restored it), and a floating CS lets the card drive MISO
// and corrupt every other transfer on the bus, so it is driven HIGH at boot and
// never touched again.
#define PIN_TFT_SD_CS  26

#define TFT_ROTATION   1  // 0/2 portrait, 1/3 landscape

// Touch calibration — raw XPT2046 counts at the screen edges, *after* the
// touch library applies TFT_ROTATION (display.cpp calls setRotation on it).
// These are only the fallback: the on-screen calibration saves measured values
// to flash and those take precedence. To run it, hold the button while the
// terminal powers on (or set TOUCH_CALIBRATION_MODE to 1 to force it).
// A LEFT greater than RIGHT (or TOP greater than BOTTOM) is valid and means
// that axis is mirrored on this panel; TOUCH_SWAP_XY means the raw axes are
// crossed relative to the display.
#define TOUCH_CALIBRATION_MODE 0
#define TOUCH_RAW_LEFT   413
#define TOUCH_RAW_RIGHT  3793
#define TOUCH_RAW_TOP    315
#define TOUCH_RAW_BOTTOM 3761
#define TOUCH_SWAP_XY    0

// Preview images are full-screen QVGA JPEGs from the CAM (320x240, the panel's
// own resolution), decoded straight onto the TFT. This is the receive buffer
// cap — a quality-12 QVGA frame is ~10-15 KB.
#define PREVIEW_MAX_JPEG 32768

// Byte order of the decoded RGB565 pixels. Adafruit_GFX's drawRGBBitmap()
// takes native-endian uint16_t and swaps for the panel itself, so the decoder
// must NOT pre-swap — doing that is what turns the picture into green/purple
// blocky noise. (TFT_eSPI's pushImage is the opposite; set this to 1 there.)
#define PREVIEW_SWAP_BYTES 0

// --------------------------------------------------------------------- PN532
#define PIN_PN532_SS   13

// The PN532 is the reason this bus needs care: it clocks SPI *LSB-first*, while
// the ILI9341 and XPT2046 are MSB-first. Sharing is only safe if every driver
// brackets its transfers in SPI.beginTransaction()/endTransaction(), which
// re-applies bit order and speed per transaction. All three libraries pinned in
// README.md do. If you swap one out, verify that first — the failure mode is
// intermittent corruption that looks like bad wiring.
#define PN532_SPI_HZ   1000000

// ------------------------------------------------------ UART link to ESP32-CAM
#define PIN_CAM_RX     16  // ESP32 RX2  <- CAM GPIO1 (U0TXD)
#define PIN_CAM_TX     17  // ESP32 TX2  -> CAM GPIO3 (U0RXD)
// Defined once in protocol.h (PROTO_BAUD) so the CAM and terminal always match.
#define CAM_BAUD       PROTO_BAUD

#endif  // COOPSETU_CONFIG_H
