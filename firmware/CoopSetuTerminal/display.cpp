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
  
  // 1. FORCE the SPI bus to use our specific physical pins FIRST.
  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

  // 2. Deselect ALL devices sharing the SPI bus before initialization.
  pinMode(PIN_TFT_SD_CS, OUTPUT); digitalWrite(PIN_TFT_SD_CS, HIGH);
  pinMode(PIN_TOUCH_CS, OUTPUT);  digitalWrite(PIN_TOUCH_CS, HIGH);
  pinMode(PIN_PN532_SS, OUTPUT);  digitalWrite(PIN_PN532_SS, HIGH);
  pinMode(PIN_TFT_CS, OUTPUT);    digitalWrite(PIN_TFT_CS, HIGH);

  // 4. Now the SPI bus is 100% clean and MISO is floating. Safe to boot TFT.
  g_tft.begin();
  g_tft.setRotation(TFT_ROTATION);
  W = g_tft.width();
  H = g_tft.height();
  g_tft.fillScreen(COL_BG);
}

void touchInit() {
  // User fixed the hardware! Re-enabling touch initialization.
  g_touch.begin();
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
  
  TS_Point p = g_touch.getPoint();

  // Hardware sanity check: if MISO is floating high (touch controller missing
  // or not responding), the SPI reads return 0xFFFF. The library's math turns
  // this into z = 4095 and x/y = 8191. If we see this, it's a fake touch!
  if (p.z >= 4095 || p.x == 8191 || p.y == 8191) {
    return false;
  }

  // The raw X/Y from the XPT2046 need mapping to the screen. The touch
  // controller's raw axes are tied to the panel's native (portrait) wiring,
  // not to g_tft.setRotation() — in landscape (rotation 1/3) the raw axes
  // must be swapped or every tap lands on the wrong control relative to what
  // was drawn. These calibration values must be tuned per physical assembly
  // in config.h.
  int32_t sx, sy;
#if (TFT_ROTATION == 1) || (TFT_ROTATION == 3)
  sx = map(p.y, TOUCH_RAW_MIN_Y, TOUCH_RAW_MAX_Y, 0, displayWidth());
  sy = map(p.x, TOUCH_RAW_MIN_X, TOUCH_RAW_MAX_X, 0, displayHeight());
#if (TFT_ROTATION == 1)
  sy = displayHeight() - 1 - sy;  // rotation 1 also mirrors the swapped Y axis
#else
  sx = displayWidth() - 1 - sx;   // rotation 3 mirrors the swapped X axis instead
#endif
#else
  sx = map(p.x, TOUCH_RAW_MIN_X, TOUCH_RAW_MAX_X, 0, displayWidth());
  sy = map(p.y, TOUCH_RAW_MIN_Y, TOUCH_RAW_MAX_Y, 0, displayHeight());
#endif
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
