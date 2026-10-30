// Small touch-button helper for the ILI9341 UI.
//
// Drawn using Adafruit_GFX primitives already available in display.cpp. Each
// screen defines its buttons as a small static array on entry and calls
// hitTest() from onTouch to determine which button was tapped.

#ifndef COOPSETU_UI_BUTTON_H
#define COOPSETU_UI_BUTTON_H

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>

#include "display.h"

struct UiButton {
  int16_t x, y, w, h;
  const char *label;
  uint16_t bgColor;
  uint16_t textColor;
  uint8_t  textSize;
};

// Standard bottom-left "< Back" button shared by every sub-screen, so the
// drawn rect and the hit-tested rect can never drift apart.
static const UiButton kBackBtn = {10, 220, 60, 20, "< Back", COL_PANEL, COL_MUTED, 1};

// Returns true if the given screen coordinates are inside the button.
inline bool hitTest(const UiButton &btn, int16_t tx, int16_t ty) {
  return tx >= btn.x && tx < btn.x + btn.w &&
         ty >= btn.y && ty < btn.y + btn.h;
}

// Draws a button to the TFT. Call once from onEnter — buttons are static
// between screen transitions and should not be redrawn per-tick.
inline void drawButton(Adafruit_ILI9341 &tft, const UiButton &btn) {
  tft.fillRoundRect(btn.x, btn.y, btn.w, btn.h, 4, btn.bgColor);
  tft.drawRoundRect(btn.x, btn.y, btn.w, btn.h, 4, COL_MUTED);

  const uint8_t sz = btn.textSize ? btn.textSize : 1;
  const int16_t charW = 6 * sz;
  const int16_t charH = 8 * sz;
  const int16_t textLen = strlen(btn.label);
  const int16_t textW = textLen * charW;

  const int16_t cx = btn.x + (btn.w - textW) / 2;
  const int16_t cy = btn.y + (btn.h - charH) / 2;

  tft.setTextSize(sz);
  tft.setTextColor(btn.textColor);
  tft.setCursor(cx, cy);
  tft.print(btn.label);
}

// Draws a button with an inverted (pressed) appearance.
inline void drawButtonPressed(Adafruit_ILI9341 &tft, const UiButton &btn) {
  tft.fillRoundRect(btn.x, btn.y, btn.w, btn.h, 4, btn.textColor);
  tft.drawRoundRect(btn.x, btn.y, btn.w, btn.h, 4, COL_ACCENT);

  const uint8_t sz = btn.textSize ? btn.textSize : 1;
  const int16_t charW = 6 * sz;
  const int16_t charH = 8 * sz;
  const int16_t textLen = strlen(btn.label);
  const int16_t textW = textLen * charW;

  const int16_t cx = btn.x + (btn.w - textW) / 2;
  const int16_t cy = btn.y + (btn.h - charH) / 2;

  tft.setTextSize(sz);
  tft.setTextColor(btn.bgColor);
  tft.setCursor(cx, cy);
  tft.print(btn.label);
}

// Hit-tests against an array of buttons, returns the index of the first hit
// or -1 if none.
inline int hitTestArray(const UiButton *btns, int count, int16_t tx, int16_t ty) {
  for (int i = 0; i < count; i++) {
    if (hitTest(btns[i], tx, ty)) return i;
  }
  return -1;
}

#endif  // COOPSETU_UI_BUTTON_H
