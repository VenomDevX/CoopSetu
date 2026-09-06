// Pin map and site configuration for the CoopSetu attendance terminal
// (ESP32 38-pin devkit). Every pin below is transcribed from Hardware.md.

#ifndef COOPSETU_CONFIG_H
#define COOPSETU_CONFIG_H

// ---------------------------------------------------------------- Wi-Fi / API
#define WIFI_SSID       "CHANGE_ME"
#define WIFI_PASSWORD   "CHANGE_ME"

// Base URL of the CoopSetu server, no trailing slash.
// Must be reachable from the terminal's network. https:// is strongly
// preferred; see API_TLS_INSECURE below before using it.
#define API_BASE_URL    "http://192.168.1.10:3000"

// Sent as `Authorization: Bearer <token>`.
//
// IMPORTANT: app/api/v1/attendance/qr/route.ts currently authenticates with
// createClient() — a *cookie* session belonging to a signed-in human. A device
// has no cookie, so as of this commit these requests are rejected. The server
// needs a device-token guard before the terminal can post attendance; see
// firmware/README.md ("Backend work required"). The header is sent now so no
// firmware change is needed once that lands.
#define API_DEVICE_TOKEN "CHANGE_ME"

// Skips certificate validation on https://. Convenient on a LAN with a
// self-signed cert, and unacceptable in production: it accepts any certificate,
// so anything on the path can read and rewrite attendance traffic. Ship false.
#define API_TLS_INSECURE true

#define HTTP_TIMEOUT_MS  8000

// ------------------------------------------------------------------- Behaviour
#define QR_SESSION_TTL_MS   (4UL * 60UL * 60UL * 1000UL)  // re-arm after 4 h
#define IDENTIFY_TIMEOUT_MS 12000    // give up on a face after this long
#define RESULT_DWELL_MS     2500     // how long a result screen stays up
#define BUTTON_LONG_PRESS_MS 1200    // long press = re-arm session
#define FACE_MIN_CONFIDENCE  0.62f   // reject weaker matches from the CAM

// ----------------------------------------------------------------- LEDs/buzzer
#define PIN_LED_GREEN  21
#define PIN_LED_RED    22
#define PIN_BUZZER     32

// Hardware.md wires the buzzer straight to GPIO32. That is only safe for a
// low-current 3.3 V *active* buzzer (ESP32 pins are rated ~12 mA continuous,
// 40 mA absolute max). If yours is passive, set this to 1 to drive it with a
// LEDC tone instead of a DC level.
#define BUZZER_IS_PASSIVE 0
#define BUZZER_LEDC_CH    0
#define BUZZER_TONE_HZ    2700

// ---------------------------------------------------------------------- Button
// GPIO34 is input-only and has NO internal pull-up, which is why Hardware.md
// specifies an external one. Fit the 10 kΩ it calls for: the 200 Ω part
// currently listed would sink 3.3 V / 200 Ω ≈ 16 mA every time the button is
// held — wasteful, hot, and near the pin's continuous rating.
#define PIN_BUTTON     34
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
#define PIN_TOUCH_IRQ  25

// The TFT carries a microSD slot this project does not use. Its select line is
// wired (Hardware.md restored it), and a floating CS lets the card drive MISO
// and corrupt every other transfer on the bus, so it is driven HIGH at boot and
// never touched again.
#define PIN_TFT_SD_CS  26

#define TFT_ROTATION   1  // 0/2 portrait, 1/3 landscape

// Touch calibration — raw XPT2046 counts at the corners. Re-measure per panel:
// set TOUCH_CALIBRATION_MODE to 1, watch the serial monitor, tap each corner.
#define TOUCH_CALIBRATION_MODE 0
#define TOUCH_RAW_MIN_X 320
#define TOUCH_RAW_MAX_X 3900
#define TOUCH_RAW_MIN_Y 300
#define TOUCH_RAW_MAX_Y 3800

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
#define CAM_BAUD       115200

#endif  // COOPSETU_CONFIG_H
