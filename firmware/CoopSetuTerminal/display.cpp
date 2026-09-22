#include "display.h"
#include "config.h"

#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>
#include <Preferences.h>

namespace {

Adafruit_ILI9341 g_tft(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);
XPT2046_Touchscreen g_touch(PIN_TOUCH_CS, PIN_TOUCH_IRQ);

int16_t W = 320, H = 240;
// Active calibration: config.h defaults, replaced by NVS values if saved.
struct TouchCal {
  int16_t left, right, top, bottom;
  bool swapXY;
};
TouchCal g_cal = {TOUCH_RAW_LEFT, TOUCH_RAW_RIGHT, TOUCH_RAW_TOP,
                  TOUCH_RAW_BOTTOM, TOUCH_SWAP_XY != 0};

const char *kCalNs = "touchcal";

void loadCalibration() {
  Preferences prefs;
  if (!prefs.begin(kCalNs, true)) return;  // nothing saved yet: keep defaults
  if (prefs.getUChar("v", 0) == 1) {
    g_cal.left   = prefs.getShort("l", g_cal.left);
    g_cal.right  = prefs.getShort("r", g_cal.right);
    g_cal.top    = prefs.getShort("t", g_cal.top);
    g_cal.bottom = prefs.getShort("b", g_cal.bottom);
    g_cal.swapXY = prefs.getBool("s", g_cal.swapXY);
    Serial.printf("touch: saved calibration L=%d R=%d T=%d B=%d swap=%d\n",
                  g_cal.left, g_cal.right, g_cal.top, g_cal.bottom, g_cal.swapXY);
  }
  prefs.end();
}

void saveCalibration() {
  Preferences prefs;
  if (!prefs.begin(kCalNs, false)) return;
  prefs.putShort("l", g_cal.left);
  prefs.putShort("r", g_cal.right);
  prefs.putShort("t", g_cal.top);
  prefs.putShort("b", g_cal.bottom);
  prefs.putBool("s", g_cal.swapXY);
  prefs.putUChar("v", 1);
  prefs.end();
}

// Raw point after the library's rotation, or false for no/implausible touch.
bool readRaw(int16_t *rx, int16_t *ry) {
  if (!g_touch.touched()) return false;
  TS_Point p = g_touch.getPoint();
  // A missing/unresponsive controller reads back all-ones on MISO, which the
  // library turns into z = 4095 and out-of-range coordinates.
  if (p.z >= 4095 || p.x < 0 || p.x > 4095 || p.y < 0 || p.y > 4095) return false;
  *rx = p.x;
  *ry = p.y;
  return true;
}

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
  g_touch.begin();
  // The library rotates raw points itself; matching the TFT means raw X
  // already runs along the display's width, so touchGet() is a plain per-axis
  // scale. (Swapping/mirroring again on top of this is what broke taps.)
  g_touch.setRotation(TFT_ROTATION);
  loadCalibration();
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
  int16_t rx, ry;
  if (!readRaw(&rx, &ry)) return false;
  if (g_cal.swapXY) { int16_t t = rx; rx = ry; ry = t; }

  // map() handles reversed ranges, so a mirrored axis needs no special case.
  const int32_t sx = map(rx, g_cal.left, g_cal.right, 0, W - 1);
  const int32_t sy = map(ry, g_cal.top, g_cal.bottom, 0, H - 1);
  *x = constrain(sx, 0, W - 1);
  *y = constrain(sy, 0, H - 1);
  return true;
}

namespace {

void drawTarget(int16_t x, int16_t y, uint16_t colour) {
  g_tft.drawFastHLine(x - 10, y, 21, colour);
  g_tft.drawFastVLine(x, y - 10, 21, colour);
  g_tft.drawCircle(x, y, 6, colour);
}

bool buttonDown() {
  return digitalRead(PIN_BUTTON) == (BUTTON_ACTIVE_LOW ? LOW : HIGH);
}

// Waits for a press, averages the readings while held, then waits for the
// release so one tap cannot register on the next target too.
void sampleTarget(int16_t x, int16_t y, int32_t *outX, int32_t *outY) {
  fillContentArea();
  drawWrappedText("Tap the centre of the target with a stylus.", 8, 40, 1, COL_TEXT);
  drawTarget(x, y, COL_ACCENT);

  int16_t rx = 0, ry = 0;
  while (!readRaw(&rx, &ry)) delay(10);
  delay(60);  // let the reading settle once contact is firm

  int32_t sumX = 0, sumY = 0, n = 0;
  uint32_t lastTouch = millis();
  while (millis() - lastTouch < 120) {
    if (readRaw(&rx, &ry)) {
      if (n < 64) { sumX += rx; sumY += ry; n++; }
      lastTouch = millis();
    }
    delay(10);
  }
  *outX = n ? sumX / n : rx;
  *outY = n ? sumY / n : ry;
  drawTarget(x, y, COL_OK);
  Serial.printf("  target (%d,%d): raw x=%ld y=%ld (%ld samples)\n",
                x, y, (long)*outX, (long)*outY, (long)n);
  delay(300);
}

// Extrapolates the raw values at pixel 0 and pixel size-1 from two samples
// taken at pixels a and b.
void edgesFrom(int32_t rawA, int32_t rawB, int16_t a, int16_t b, int16_t size,
               int16_t *lo, int16_t *hi) {
  const float perPx = float(rawB - rawA) / float(b - a);
  *lo = int16_t(rawA - perPx * a);
  *hi = int16_t(rawB + perPx * (size - 1 - b));
}

// Draws a dot wherever the panel is touched until the button is pressed, so
// the result can be checked by eye.
void tapTest() {
  g_tft.fillScreen(COL_BG);
  drawHeader("TOUCH TEST");
  for (int16_t gx = 40; gx < W; gx += 80) g_tft.drawFastVLine(gx, 28, H - 28, COL_PANEL);
  for (int16_t gy = 68; gy < H; gy += 60) g_tft.drawFastHLine(0, gy, W, COL_PANEL);
  drawWrappedText("Tap around: dots should appear under the stylus. "
                  "Press the button to continue.", 8, 36, 1, COL_MUTED);

  while (buttonDown()) delay(10);  // ignore a still-held boot press
  while (!buttonDown()) {
    int16_t x, y;
    if (touchGet(&x, &y)) g_tft.fillCircle(x, y, 2, COL_OK);
    delay(10);
  }
  while (buttonDown()) delay(10);
}

}  // namespace

void touchCalibrate() {
  g_tft.fillScreen(COL_BG);
  drawHeader("TOUCH CALIBRATION");
  Serial.println("touch calibration: tap the three targets");

  const int16_t inset = 24;
  const int16_t xL = inset, xR = W - 1 - inset;
  const int16_t yT = 28 + inset, yB = H - 1 - inset;  // clear of the header

  for (;;) {
    int32_t tlX, tlY, trX, trY, blX, blY;
    sampleTarget(xL, yT, &tlX, &tlY);
    sampleTarget(xR, yT, &trX, &trY);
    sampleTarget(xL, yB, &blX, &blY);

    // Moving right on screen should change mostly one raw axis; if that is
    // raw Y, the axes are crossed.
    const bool swap = labs(trY - tlY) > labs(trX - tlX);
    if (swap) {
      int32_t t;
      t = tlX; tlX = tlY; tlY = t;
      t = trX; trX = trY; trY = t;
      t = blX; blX = blY; blY = t;
    }

    TouchCal cal;
    cal.swapXY = swap;
    edgesFrom(tlX, trX, xL, xR, W, &cal.left, &cal.right);
    edgesFrom(tlY, blY, yT, yB, H, &cal.top, &cal.bottom);

    // A real panel spans thousands of counts; a small span means a missed or
    // doubled tap, so start over rather than save something unusable.
    if (abs(cal.right - cal.left) < 1000 || abs(cal.bottom - cal.top) < 1000) {
      fillContentArea();
      drawWrappedText("Taps too close together - try again.", 8, 60, 2, COL_ERR);
      Serial.println("touch calibration: implausible span, retrying");
      delay(1500);
      continue;
    }

    g_cal = cal;
    saveCalibration();
    Serial.println("touch calibration saved. Equivalent config.h values:");
    Serial.printf("#define TOUCH_RAW_LEFT   %d\n", cal.left);
    Serial.printf("#define TOUCH_RAW_RIGHT  %d\n", cal.right);
    Serial.printf("#define TOUCH_RAW_TOP    %d\n", cal.top);
    Serial.printf("#define TOUCH_RAW_BOTTOM %d\n", cal.bottom);
    Serial.printf("#define TOUCH_SWAP_XY    %d\n", cal.swapXY ? 1 : 0);
    break;
  }

  tapTest();
}
