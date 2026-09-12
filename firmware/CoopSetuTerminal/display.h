// ILI9341 + XPT2046 touch. Screens are drawn only when state changes.

#ifndef COOPSETU_DISPLAY_H
#define COOPSETU_DISPLAY_H

#include <Arduino.h>
#include <Adafruit_ILI9341.h>

// CoopSetu accent (#7C5CFC) and greys, converted to RGB565 so the terminal
// matches the web and mobile apps.
#define COL_BG      0x0000  // #000000
#define COL_PANEL   0x18E3  // #1A1C1A-ish
#define COL_TEXT    0xFFFF
#define COL_MUTED   0x8410  // mid grey
#define COL_ACCENT  0x7BFF  // #7C5CFC
#define COL_OK      0x0660  // green
#define COL_ERR     0xF9A6  // red

void displayBegin();

// Initialize the XPT2046 touch controller. Called once from setup() after
// displayBegin(). Separated so touch can be brought up after SPI is stable.
void touchInit();

// Full-screen states (legacy — used by screen implementations).
void screenBoot(const char *line);
void screenArmSession();                 // "scan the trainer's QR"
void screenIdle(const char *sessionLabel, int marked);
void screenBusy(const char *what);
void screenResult(bool ok, const char *title, const char *detail);
void screenEnroll(const char *who, int slot);

// True if the panel was touched since the last call; fills screen coords.
bool touchGet(int16_t *x, int16_t *y);

// Prints raw touch counts to Serial for calibrating TOUCH_RAW_* in config.h.
void touchCalibrationLoop();

// Direct access to the TFT for screen implementations that need custom drawing.
Adafruit_ILI9341& getTft();

// Screen dimensions (after rotation).
int16_t displayWidth();
int16_t displayHeight();

// Draw the standard CoopSetu header bar with a title.
void drawHeader(const char *title);

// Clear the content area below the header without touching the header itself.
// Use this instead of fillScreen to avoid header flicker on screen transitions.
void fillContentArea(uint16_t color = COL_BG);

// Word-wraps text into a region. Exposed for screen implementations.
void drawWrappedText(const char *s, int16_t x, int16_t y, uint8_t size, uint16_t colour);

#endif  // COOPSETU_DISPLAY_H
