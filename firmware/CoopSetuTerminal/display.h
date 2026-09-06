// ILI9341 + XPT2046 touch. Screens are drawn only when state changes.

#ifndef COOPSETU_DISPLAY_H
#define COOPSETU_DISPLAY_H

#include <Arduino.h>

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

// Full-screen states.
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

#endif  // COOPSETU_DISPLAY_H
