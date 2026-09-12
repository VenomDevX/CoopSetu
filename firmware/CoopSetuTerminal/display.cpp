#include "display.h"
#include "config.h"

#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>

namespace {

Adafruit_ILI9341 g_tft(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
XPT2046_Touchscreen g_touch(PIN_TOUCH_CS, PIN_TOUCH_IRQ);

int16_t W = 320, H = 240;
bool g_touchInitialized = false;

}  // namespace

// Public accessors
Adafruit_ILI9341& getTft() { return g_tft; }
int16_t displayWidth()  { return W; }
int16_t displayHeight() { return H; }

void drawHeader(const char *title) {
  g_tft.fillRect(0, 0, W, 28, COL_PANEL);
  g_tft.setTextColor(COL_ACCENT);
  g_tft.setTextSize(1);
  g_tft.setCursor(8, 10);
  g_tft.print("COOPSETU");
  g_tft.setTextColor(COL_MUTED);
  g_tft.setCursor(88, 10);
  g_tft.print(title);
}

void fillContentArea(uint16_t color) {
  g_tft.fillRect(0, 28, W, H - 28, color);
}

// Word-wraps into the content area at the given text size.
void drawWrappedText(const char *s, int16_t x, int16_t y, uint8_t size, uint16_t colour) {
  g_tft.setTextSize(size);
  g_tft.setTextColor(colour);
  const int16_t charW = 6 * size, lineH = 8 * size + 4;
  const int16_t maxChars = (W - x - 8) / charW;

  int16_t cy = y;
  const char *p = s;
  while (*p) {
    int16_t n = 0, lastSpace = -1;
    while (p[n] && n < maxChars) {
      if (p[n] == ' ') lastSpace = n;
      n++;
    }
    if (p[n] && lastSpace > 0) n = lastSpace;

    g_tft.setCursor(x, cy);
    for (int16_t i = 0; i < n; i++) g_tft.write(p[i]);
    cy += lineH;
    p += n;
    while (*p == ' ') p++;
  }
}

// Legacy wrapper kept for existing screen functions
namespace {
void header(const char *title) { drawHeader(title); }
void wrapText(const char *s, int16_t x, int16_t y, uint8_t size, uint16_t colour) {
  drawWrappedText(s, x, y, size, colour);
}
}  // namespace

void displayBegin() {
  // Every device on the shared VSPI bus (TFT's unused microSD, the XPT2046
  // touch controller, the PN532) must be deselected before ANY of them talks —
  // otherwise a floating CS can get selected by noise mid-transaction and
  // drive MISO back, corrupting whichever transfer was actually in flight.
  // The SD card CS was already handled here; touch and PN532 previously
  // weren't deselected until touchInit()/nfcBegin() ran, well after this
  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

  g_tft.begin();
  g_tft.setRotation(TFT_ROTATION);
  W = g_tft.width();
  H = g_tft.height();
  g_tft.fillScreen(COL_BG);
}

void touchInit() {
  // Now that SPI is safely initialized with ss=-1 in displayBegin(),
  // we can safely call g_touch.begin() without it hijacking GPIO 5.
  g_touch.begin();
  g_touchInitialized = true;
}

void screenBoot(const char *line) {
  g_tft.fillScreen(COL_BG);
  g_tft.setTextColor(COL_ACCENT);
  g_tft.setTextSize(3);
  g_tft.setCursor(16, 70);
  g_tft.print("COOPSETU");
  g_tft.setTextSize(1);
  g_tft.setTextColor(COL_MUTED);
  g_tft.setCursor(18, 104);
  g_tft.print("ATTENDANCE TERMINAL");
  g_tft.fillRect(0, H - 34, W, 34, COL_PANEL);
  g_tft.setTextColor(COL_TEXT);
  g_tft.setCursor(10, H - 22);
  g_tft.print(line);
}

void screenArmSession() {
  g_tft.fillScreen(COL_BG);
  header("SETUP");
  g_tft.setTextSize(2);
  g_tft.setTextColor(COL_TEXT);
  g_tft.setCursor(10, 54);
  g_tft.print("Arm a session");
  wrapText("Hold the trainer's attendance QR in front of the camera.",
           10, 88, 1, COL_MUTED);
  g_tft.fillRect(0, H - 30, W, 30, COL_PANEL);
  g_tft.setTextColor(COL_ACCENT);
  g_tft.setTextSize(1);
  g_tft.setCursor(10, H - 20);
  g_tft.print("Long-press the button to re-arm later");
}

void screenIdle(const char *sessionLabel, int marked) {
  g_tft.fillScreen(COL_BG);
  header("READY");

  g_tft.setTextSize(2);
  g_tft.setTextColor(COL_TEXT);
  g_tft.setCursor(10, 56);
  g_tft.print("Tap card");
  g_tft.setTextColor(COL_MUTED);
  g_tft.setCursor(10, 82);
  g_tft.setTextSize(1);
  g_tft.print("or press the button for face check-in");

  g_tft.drawFastHLine(10, 116, W - 20, COL_PANEL);
  g_tft.setTextColor(COL_MUTED);
  g_tft.setCursor(10, 128);
  g_tft.print("SESSION ");
  g_tft.setTextColor(COL_ACCENT);
  g_tft.print(sessionLabel);

  g_tft.setTextColor(COL_MUTED);
  g_tft.setCursor(10, 146);
  g_tft.print("MARKED   ");
  g_tft.setTextColor(COL_TEXT);
  g_tft.setTextSize(2);
  g_tft.print(marked);
}

void screenBusy(const char *what) {
  g_tft.fillScreen(COL_BG);
  header("WORKING");
  g_tft.setTextSize(2);
  g_tft.setTextColor(COL_ACCENT);
  g_tft.setCursor(10, 100);
  g_tft.print(what);
}

void screenResult(bool ok, const char *title, const char *detail) {
  const uint16_t c = ok ? COL_OK : COL_ERR;
  g_tft.fillScreen(COL_BG);
  g_tft.fillRect(0, 0, W, 6, c);
  g_tft.setTextSize(3);
  g_tft.setTextColor(c);
  g_tft.setCursor(10, 46);
  g_tft.print(ok ? "OK" : "NO");
  g_tft.setTextSize(2);
  g_tft.setTextColor(COL_TEXT);
  g_tft.setCursor(10, 90);
  g_tft.print(title);
  if (detail && *detail) wrapText(detail, 10, 124, 1, COL_MUTED);
}

void screenEnroll(const char *who, int slot) {
  g_tft.fillScreen(COL_BG);
  header("ENROL FACE");
  g_tft.setTextSize(2);
  g_tft.setTextColor(COL_TEXT);
  g_tft.setCursor(10, 56);
  g_tft.print(who);
  char line[48];
  snprintf(line, sizeof(line), "Look at the camera. Slot %d.", slot);
  wrapText(line, 10, 92, 1, COL_MUTED);
}

bool touchGet(int16_t *x, int16_t *y) {
  if (!g_touch.touched()) return false;
  const TS_Point p = g_touch.getPoint();
  if (p.z < 200) return false;  // reject feather-light noise

  int32_t sx = map(p.x, TOUCH_RAW_MIN_X, TOUCH_RAW_MAX_X, 0, W);
  int32_t sy = map(p.y, TOUCH_RAW_MIN_Y, TOUCH_RAW_MAX_Y, 0, H);
  *x = constrain(sx, 0, W - 1);
  *y = constrain(sy, 0, H - 1);
  return true;
}

void touchCalibrationLoop() {
  g_tft.fillScreen(COL_BG);
  wrapText("Calibration: tap each corner, note the raw values on serial, "
           "then set TOUCH_RAW_* in config.h and clear TOUCH_CALIBRATION_MODE.",
           8, 16, 1, COL_TEXT);
  for (;;) {
    if (g_touch.touched()) {
      const TS_Point p = g_touch.getPoint();
      Serial.printf("raw x=%d y=%d z=%d\n", p.x, p.y, p.z);
      delay(150);
    }
    delay(10);
  }
}
