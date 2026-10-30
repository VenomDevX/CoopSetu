// Screen-stack implementation for the CoopSetu attendance terminal.
//
// Each screen registers enter/tick/touch/exit callbacks. The stack is just a
// small array (max depth 4). push/pop/replace handle the lifecycle calls.

#include "screens.h"
#include "display.h"
#include "ui_button.h"
#include "config.h"
#include "nfc.h"
#include "camlink.h"
#include "net_task.h"
#include <ArduinoJson.h>
#include <Preferences.h>
#include "feedback.h"
#include "offline.h"
#include <WiFi.h>
#include <TJpg_Decoder.h>

// ======================================================================= stack

namespace {

const int kMaxDepth = 4;
ScreenId g_stack[kMaxDepth];
int g_top = -1;

Screen g_screens[SCR_COUNT];

// Shared result state — set by showResultScreen(), consumed by SCR_RESULT.
bool g_resultOk = false;
char g_resultTitle[64]  = {0};
char g_resultDetail[128] = {0};
uint32_t g_resultShownAt = 0;

// Admin PIN state
char g_adminPin[5] = {0};  // current NVS-stored PIN

// PIN pad input state
char g_pinInput[5] = {0};
int  g_pinLen = 0;

// Admin registration state machine
int  g_regStep = 0;    // 0=role, 3=scan, 4=confirm
char g_regRole[16]  = {0};
char g_regInstId[40] = {0};
char g_regInstName[48] = {0};
char g_regUserId[40]   = {0};
char g_regUserName[64] = {0};
char g_regRfidUid[21]  = {0};
char g_regCardCredential[48] = {0};
char g_regOrgId[40]    = {0};
int  g_regUserOffset = 0;
bool g_regResume = false;

// ARM screen state
uint32_t g_armEnteredAt = 0;
uint32_t g_statusRequestId = 0;
uint32_t g_adminRequestId = 0;
uint32_t g_userPageRequestId = 0;

}  // namespace

// ================================================================== lifecycle

void screensBegin() {

  // Zero everything
  memset(g_screens, 0, sizeof(g_screens));
  g_top = -1;

  // Load admin PIN from NVS (or use default)
  Preferences prefs;
  prefs.begin("coopsetu", true);
  strncpy(g_adminPin, prefs.getString("admin_pin", DEFAULT_ADMIN_PIN).c_str(), 4);
  g_adminPin[4] = '\0';
  prefs.end();
}

void pushScreen(ScreenId id) {
  if (g_top >= 0 && g_top < kMaxDepth) {
    Screen *old = &g_screens[g_stack[g_top]];
    if (old->onExit) old->onExit();
  }
  if (g_top < kMaxDepth - 1) {
    g_stack[++g_top] = id;
  }
  Screen *s = &g_screens[id];
  if (s->onEnter) s->onEnter();
}

void popScreen() {
  if (g_top <= 0) return;  // can't pop Home
  Screen *old = &g_screens[g_stack[g_top]];
  if (old->onExit) old->onExit();
  g_top--;
  Screen *s = &g_screens[g_stack[g_top]];
  if (s->onEnter) s->onEnter();
}

void replaceScreen(ScreenId id) {
  if (g_top >= 0) {
    Screen *old = &g_screens[g_stack[g_top]];
    if (old->onExit) old->onExit();
    g_stack[g_top] = id;
  } else {
    g_stack[++g_top] = id;
  }
  Screen *s = &g_screens[id];
  if (s->onEnter) s->onEnter();
}

ScreenId currentScreen() {
  return g_top >= 0 ? g_stack[g_top] : SCR_HOME;
}

Screen* activeScreen() {
  return g_top >= 0 ? &g_screens[g_stack[g_top]] : nullptr;
}

void showResultScreen(bool ok, const char *title, const char *detail) {
  g_resultOk = ok;
  strncpy(g_resultTitle, title, sizeof(g_resultTitle) - 1);
  g_resultTitle[sizeof(g_resultTitle) - 1] = '\0';
  strncpy(g_resultDetail, detail, sizeof(g_resultDetail) - 1);
  g_resultDetail[sizeof(g_resultDetail) - 1] = '\0';
  replaceScreen(SCR_RESULT);
}

// ================================================================= SCR_HOME

namespace {

// Turns a failed NetResponse into a short screen message. Transport failures
// (status <= 0) never show raw JSON; RFID taps were already queued offline by
// the network task, so they are reported as saved rather than failed.
void showNetError(const NetResponse &resp) {
  StaticJsonDocument<256> doc;
  const bool parsed = !deserializeJson(doc, resp.data);
  const char *msg = parsed ? (doc["message"] | (doc["error"] | "")) : "";

  if (resp.status <= 0) {
    if ((resp.type == NET_ATTENDANCE_RFID || resp.type == NET_ATTENDANCE_QR || resp.type == NET_ATTENDANCE_FACE) &&
        strstr(resp.data, "Saved")) {
      showResultScreen(true, "Saved Offline", "No connection. Will sync automatically.");
    } else {
      showResultScreen(false, netWifiConnected() ? "Server Unreachable" : "No Wi-Fi",
                       "Check connection and try again.");
    }
    return;
  }
  char detail[96];
  snprintf(detail, sizeof(detail), "%s (HTTP %d)", *msg ? msg : "Request failed", resp.status);
  showResultScreen(false, "Error", detail);
}

// Maps an /api/v1/attendance/rfid rejection to a screen by its `error` code.
// The endpoint returns 403 for several unrelated reasons, so the HTTP status
// alone must not decide the message — reporting every 403 as "Card Revoked"
// sent staff chasing revocations on cards that were ACTIVE. Returns false for
// codes it does not recognise so the caller can fall back to a generic error.
bool showRfidRejection(const NetResponse &resp) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, resp.data)) return false;
  const char *err = doc["error"] | "";

  if (strcmp(err, "unknown_rfid") == 0) {
    const char *uid = doc["rfid_uid"] | "";
    char msg[96];
    snprintf(msg, sizeof(msg), "Card %s not registered. Contact admin.", uid);
    showResultScreen(false, "Unknown RFID", msg);
  } else if (strcmp(err, "card_revoked") == 0) {
    showResultScreen(false, "Card Revoked", "This card has been deactivated.");
  } else if (strcmp(err, "institution_mismatch") == 0) {
    showResultScreen(false, "Wrong Institution", "Card is not valid at this terminal's institution.");
  } else if (strcmp(err, "org_mismatch") == 0) {
    showResultScreen(false, "Wrong Organisation", "Card belongs to a different organisation.");
  } else if (strcmp(err, "card_credential_required") == 0 ||
             strcmp(err, "invalid_card_credential") == 0) {
    showResultScreen(false, "Card Not Verified", "Secure card check failed. Tap again or re-enrol.");
  } else {
    return false;
  }
  return true;
}

}  // namespace

namespace {

static const UiButton kHomeBtns[] = {
  {20,  50, 280, 40, "Mark Attendance", COL_ACCENT, COL_TEXT, 2},
  {20, 110, 280, 40, "Admin Mode",      COL_PANEL,  COL_TEXT, 2},
  {20, 170, 130, 30, "Settings",        COL_PANEL,  COL_MUTED, 1},
  {170, 170, 130, 30, "Status",          COL_PANEL,  COL_MUTED, 1},
};

// Tracks what's currently drawn so homeTick() only repaints the status strip
// when something actually changed, instead of flickering every tick.
int g_homeStatusDrawn = -1;  // -1 = not drawn yet; else packed (wifi*100+pending)

void drawHomeStatus() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillRect(0, 30, displayWidth(), 12, COL_BG);

  tft.setTextSize(1);
  const char *wifiLabel = netWifiConnected() ? "WiFi OK"
                         : netWifiConnecting() ? "Connecting..."
                         : "No WiFi";
  tft.setTextColor(netWifiConnected() ? COL_OK
                   : netWifiConnecting() ? COL_ACCENT
                   : COL_ERR);
  int wifiX = tft.width() - (strlen(wifiLabel) * 6) - 10;
  tft.setCursor(wifiX, 32);
  tft.print(wifiLabel);

  const int pending = netPendingCount() + offlineCount();
  if (pending > 0) {
    tft.setTextColor(COL_MUTED);
    tft.setCursor(8, 32);
    tft.print("Pending: ");
    tft.print(pending);
  }
}

void homeEnter() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Home");

  g_homeStatusDrawn = -1;
  drawHomeStatus();

  for (int i = 0; i < 4; i++) drawButton(tft, kHomeBtns[i]);
}

void homeTick() {
  // Repaint the WiFi/pending strip only when its state actually changed.
  const int state = (netWifiConnected() ? 2 : netWifiConnecting() ? 1 : 0) * 1000 +
                     (netPendingCount() + offlineCount());
  if (state != g_homeStatusDrawn) {
    g_homeStatusDrawn = state;
    drawHomeStatus();
  }

  // Poll NFC even on home screen for quick-tap attendance
  NfcCard card;
  if (nfcPoll(&card)) {
    // Direct RFID attendance from home screen
    NetRequest req;
    req.type = NET_ATTENDANCE_RFID;
    snprintf(req.payload, sizeof(req.payload),
      "{\"rfid_uid\":\"%s\",\"card_credential\":\"%s\"}", card.uid, card.credential);
    g_statusRequestId = netEnqueue(req);
    if (g_statusRequestId) {
      replaceScreen(SCR_STATUS);
    } else {
      showResultScreen(false, "System Busy", "Network queue full. Try again.");
    }
  }

  // Check for network responses
  NetResponse resp;
  if (g_statusRequestId && netDequeueFor(g_statusRequestId, &resp)) {
    if (resp.type == NET_ATTENDANCE_RFID) {
      if (resp.ok) {
        // Parse user name from response
        StaticJsonDocument<384> doc;
        deserializeJson(doc, resp.data);
        const char *name = doc["user"]["name"] | "Unknown";
        const char *role = doc["user"]["role"] | "";
        const char *course = doc["session"]["courseTitle"] | "";
        const char *batch = doc["session"]["batchName"] | "";
        const char *status = doc["status"] | "PRESENT";
        const char *message = doc["message"] | "Attendance marked";
        bool marked = doc["attendance_marked"] | false;

        char title[64], detail[128];
        if (marked) {
          snprintf(title, sizeof(title), "%s", name);
          snprintf(detail, sizeof(detail), "%s | %s | %s", *course ? course : (*batch ? batch : role), status, message);
        } else {
          snprintf(title, sizeof(title), "%s", name);
          snprintf(detail, sizeof(detail), "%s — Already Marked", role);
        }
        showResultScreen(true, title, detail);
      } else if (resp.status == 404) {
        showResultScreen(false, "Unknown RFID", "Card not registered");
      } else {
        showNetError(resp);
      }
    }
  }
}

void homeTouch(int16_t x, int16_t y) {
  int idx = hitTestArray(kHomeBtns, 4, x, y);
  switch (idx) {
    case 0: pushScreen(SCR_ATTENDANCE_MENU); break;
    case 1: pushScreen(SCR_ADMIN_LOGIN);     break;
    case 2: pushScreen(SCR_SETTINGS);        break;
    case 3: pushScreen(SCR_DEVICE_STATUS);   break;
  }
}

}  // namespace

// ========================================================= SCR_ATTENDANCE_MENU

namespace {

static const UiButton kMenuBtns[] = {
  {20,  50, 280, 40, "RFID Card",      COL_ACCENT, COL_TEXT, 2},
  {20, 110, 280, 40, "QR Code Scan",   COL_ACCENT, COL_TEXT, 2},
  {20, 170, 280, 40, "Face ID",        COL_ACCENT, COL_TEXT, 2},
  {10, 220, 60,  20, "< Back",         COL_PANEL,  COL_MUTED, 1},
};

void menuEnter() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Attendance");
  for (int i = 0; i < 4; i++) drawButton(tft, kMenuBtns[i]);
}

void menuTouch(int16_t x, int16_t y) {
  int idx = hitTestArray(kMenuBtns, 4, x, y);
  switch (idx) {
    case 0: pushScreen(SCR_RFID); break;
    case 1: pushScreen(SCR_QR);   break;
    case 2: pushScreen(SCR_FACE); break;
    case 3: popScreen();          break;
  }
}

}  // namespace

// ================================================================== SCR_RFID

namespace {

static bool g_rfidWaiting = false;
static uint32_t g_rfidRequestId = 0;

void rfidEnter() {
  g_rfidWaiting = false;
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("RFID Attendance");

  tft.setTextSize(2);
  tft.setTextColor(COL_TEXT);
  tft.setCursor(40, 80);
  tft.print("Present your card");
  tft.setCursor(50, 110);
  tft.setTextColor(COL_MUTED);
  tft.setTextSize(1);
  tft.print("Hold card near the reader...");

  drawButton(tft, kBackBtn);
}

void rfidTick() {
  NfcCard card;
  if (!g_rfidWaiting && nfcPoll(&card)) {
    g_rfidWaiting = true;

    // Show scanning feedback
    Adafruit_ILI9341 &tft = getTft();
    tft.fillRect(0, 140, displayWidth(), 40, COL_BG);
    tft.setTextSize(1);
    tft.setTextColor(COL_ACCENT);
    tft.setCursor(60, 150);
    tft.print("Scanning... ");
    tft.print(card.uid);

    // Enqueue to netTask
    NetRequest req;
    req.type = NET_ATTENDANCE_RFID;
    snprintf(req.payload, sizeof(req.payload),
      "{\"rfid_uid\":\"%s\",\"card_credential\":\"%s\"}", card.uid, card.credential);
    g_rfidRequestId = netEnqueue(req);
    if (!g_rfidRequestId) {
      showResultScreen(false, "System Busy", "Network queue full. Try again.");
    }
  }

  // Check response
  NetResponse resp;
  if (g_rfidWaiting && netDequeueFor(g_rfidRequestId, &resp)) {
    if (resp.type == NET_ATTENDANCE_RFID) {
      g_rfidWaiting = false;
      if (resp.ok) {
        StaticJsonDocument<384> doc;
        deserializeJson(doc, resp.data);
        if (doc["capture"] | false) {
          showResultScreen(true, "Card Captured", "Complete enrollment in the dashboard.");
          return;
        }
        const char *name = doc["user"]["name"] | "Unknown";
        const char *role = doc["user"]["role"] | "";
        const char *course = doc["session"]["courseTitle"] | "";
        const char *batch = doc["session"]["batchName"] | "";
        const char *status = doc["status"] | "PRESENT";
        const char *message = doc["message"] | "Attendance marked";
        bool marked = doc["attendance_marked"] | false;

        char title[64], detail[128];
        if (marked) {
          snprintf(title, sizeof(title), "%s", name);
          snprintf(detail, sizeof(detail), "%s | %s | %s", *course ? course : (*batch ? batch : role), status, message);
        } else {
          snprintf(title, sizeof(title), "%s", name);
          snprintf(detail, sizeof(detail), "Already marked today");
        }
        showResultScreen(true, title, detail);
      } else if (resp.status <= 0 || !showRfidRejection(resp)) {
        showNetError(resp);
      }
    }
  }
}

void rfidTouch(int16_t x, int16_t y) {
  if (hitTest(kBackBtn, x, y)) popScreen();
}

}  // namespace

// ================================================================== SCR_QR

namespace {

// The preview is the whole screen: the CAM sends 320x240, the panel is
// 320x240. Labels are drawn back over the image in the corners each frame.
const int16_t kHintY = 226;    // bottom strip, over the image
const int16_t kStatusY = 210;  // result / warning line, just above it

enum PreviewGuide { GUIDE_NONE, GUIDE_QR, GUIDE_FACE };
PreviewGuide g_guide = GUIDE_NONE;
uint32_t g_lastFrameMs = 0;
uint32_t g_lastRequestMs = 0;
bool g_noImageShown = false;
char g_previewTitle[24] = {0};
char g_previewHint[48] = {0};
char g_previewStatus[64] = {0};
uint16_t g_previewStatusColour = COL_TEXT;

// Centred text with a dark plate behind it, so it stays readable over any
// image without clearing the frame underneath.
void overlayText(int16_t y, const char *text, uint16_t colour) {
  if (!text || !*text) return;
  Adafruit_ILI9341 &tft = getTft();
  const int16_t w = (int16_t)strlen(text) * 6;
  const int16_t x = (displayWidth() - w) / 2;
  tft.fillRect(x - 3, y - 2, w + 6, 12, COL_BG);
  tft.setTextSize(1);
  tft.setTextColor(colour);
  tft.setCursor(x, y);
  tft.print(text);
}

// Aiming marks so the user can line up the code/face.
void drawGuide() {
  Adafruit_ILI9341 &tft = getTft();
  const int16_t cx = displayWidth() / 2, cy = displayHeight() / 2;
  if (g_guide == GUIDE_QR) {
    const int16_t half = 72, arm = 20;
    for (int sx = -1; sx <= 1; sx += 2) {
      for (int sy = -1; sy <= 1; sy += 2) {
        const int16_t x = cx + sx * half, y = cy + sy * half;
        tft.drawFastHLine(sx < 0 ? x : x - arm + 1, y, arm, COL_OK);
        tft.drawFastVLine(x, sy < 0 ? y : y - arm + 1, arm, COL_OK);
      }
    }
  } else if (g_guide == GUIDE_FACE) {
    // Upright ellipse (GFX has no ellipse primitive).
    const float rx = 58, ry = 80;
    for (int deg = 0; deg < 360; deg += 3) {
      const float a = deg * DEG_TO_RAD;
      tft.fillRect(cx + int16_t(rx * cos(a)), cy + int16_t(ry * sin(a)) - 6, 2, 2, COL_OK);
    }
  }
}

// Corner labels + guide, repainted over every frame.
void drawPreviewChrome() {
  Adafruit_ILI9341 &tft = getTft();
  drawGuide();

  // Title, top-left corner.
  tft.fillRect(0, 0, (int16_t)strlen(g_previewTitle) * 6 + 8, 14, COL_BG);
  tft.setTextSize(1);
  tft.setTextColor(COL_ACCENT);
  tft.setCursor(4, 3);
  tft.print(g_previewTitle);

  overlayText(kStatusY, g_previewStatus, g_previewStatusColour);
  overlayText(kHintY, g_previewHint, COL_TEXT);
  drawButton(tft, kBackBtn);  // bottom-left corner
}

// Sets the status line (shown until the screen is left or it is replaced).
void previewStatus(const char *text, uint16_t colour) {
  if (!text) g_previewStatus[0] = '\0';
  else {
    strncpy(g_previewStatus, text, sizeof(g_previewStatus) - 1);
    g_previewStatus[sizeof(g_previewStatus) - 1] = '\0';
  }
  g_previewStatusColour = colour;
  overlayText(kStatusY, g_previewStatus, colour);
}

// TJpg_Decoder hands back decoded blocks; push each straight to the panel.
bool tftJpegBlock(int16_t x, int16_t y, uint16_t w, uint16_t h, uint16_t *bitmap) {
  if (y >= displayHeight()) return false;  // stop decoding below the screen
  getTft().drawRGBBitmap(x, y, bitmap, w, h);
  return true;
}

// First paint of a live-camera screen. The image itself fills the screen as
// soon as the first frame lands.
void beginPreviewScreen(const char *title, const char *hint, PreviewGuide guide) {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  strncpy(g_previewTitle, title, sizeof(g_previewTitle) - 1);
  strncpy(g_previewHint, hint ? hint : "", sizeof(g_previewHint) - 1);
  g_previewStatus[0] = '\0';
  g_guide = guide;
  g_lastFrameMs = millis();
  g_lastRequestMs = millis();
  g_noImageShown = false;

  tft.setTextSize(1);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(100, 112);
  tft.print("Starting camera...");
  drawPreviewChrome();
}

// Decodes the newest JPEG straight onto the panel (full screen), then repaints
// the labels over it. Nothing is buffered here: TJpg_Decoder hands over one
// block at a time and each goes to the TFT immediately.
void drawPreviewFrame() {
  size_t len = 0;
  const uint8_t *jpg = camTakeJpeg(&len);
  if (!jpg) {
    // A request can be lost while the CAM is busy (a face inference blocks it
    // for a few hundred ms); ask again rather than waiting forever.
    if (millis() - g_lastRequestMs > 1500) {
      g_lastRequestMs = millis();
      camRequestFrame();
    }
    // Say why, instead of freezing on a stale image.
    if (!g_noImageShown && millis() - g_lastFrameMs > 4000) {
      g_noImageShown = true;
      CamLinkStats st;
      camGetStats(&st);
      char why[64];
      if (st.lastErr[0]) {
        snprintf(why, sizeof(why), "CAM error: %.40s", st.lastErr);
      } else if (st.badFrames > 0) {
        snprintf(why, sizeof(why), "Image data corrupted (%lu) - check wires/GND",
                 (unsigned long)st.badFrames);
      } else if (st.lastRxMs == 0 || millis() - st.lastRxMs > 6000) {
        snprintf(why, sizeof(why), "CAM silent - check CAM power/TX wire");
      } else {
        snprintf(why, sizeof(why), "CAM connected but sends no image");
      }
      previewStatus(why, COL_ERR);
    }
    return;
  }
  if (g_noImageShown) {
    g_noImageShown = false;
    previewStatus(nullptr, COL_BG);
  }
  g_lastFrameMs = millis();

  TJpgDec.drawJpg(0, 0, jpg, len);
  drawPreviewChrome();

  // Ask for the next one only now, so the CAM never runs ahead of the panel.
  g_lastRequestMs = millis();
  camRequestFrame();
}

void qrEnter() {
  beginPreviewScreen("QR Attendance", "Hold the QR code inside the green corners", GUIDE_QR);
  camSetMode(CAM_QR);
  camPreviewOn();
}

void qrTick() {
  // Poll first: IMG and QR frames are decoded here. Checking liveness before
  // the first poll made a freshly booted camera fail this screen immediately.
  CamEvent ev;
  const bool hasEvent = camPoll(&ev);
  if (!camIsAlive() && millis() - g_lastFrameMs > 3000) {
    showResultScreen(false, "Camera Error", "Camera not responding.");
    return;
  }

  // Blit the latest preview frame, if one arrived
  drawPreviewFrame();

  // Check for QR decode result from CAM
  if (hasEvent && ev.type == CAM_EV_QR) {
    camPreviewOff();
    camSetMode(CAM_IDLE);
    previewStatus("QR code read - verifying...", COL_ACCENT);

    NetRequest req;
    req.type = NET_ATTENDANCE_QR;
    snprintf(req.payload, sizeof(req.payload),
      "{\"scanned_text\":\"%s\"}", ev.text);
    g_statusRequestId = netEnqueue(req);
    if (g_statusRequestId) {
      replaceScreen(SCR_STATUS);
    } else {
      showResultScreen(false, "System Busy", "Network queue full. Try again.");
    }
  }
}

void qrTouch(int16_t x, int16_t y) {
  if (hitTest(kBackBtn, x, y)) {
    camPreviewOff();
    camSetMode(CAM_IDLE);
    popScreen();
  }
}

void qrExit() {
  camPreviewOff();
  camSetMode(CAM_IDLE);
}

}  // namespace

// ================================================================= SCR_FACE

namespace {

static bool g_faceWaiting = false;
static uint32_t g_faceStartedAt = 0;
static uint32_t g_faceRequestId = 0;

void faceEnter() {
  g_faceWaiting = false;
  g_faceStartedAt = millis();
  beginPreviewScreen("Face ID", "Fit your face inside the green oval", GUIDE_FACE);
  camSetMode(CAM_FACE);
  camPreviewOn();
}

void faceTick() {
  if (!camIsAlive() && millis() - g_faceStartedAt > 3000) {
    showResultScreen(false, "Camera Error", "Camera not responding.");
    return;
  }

  // Blit the latest preview frame, if one arrived
  drawPreviewFrame();

  if (!g_faceWaiting && millis() - g_faceStartedAt > IDENTIFY_TIMEOUT_MS) {
    showResultScreen(false, "Face Timeout", "No verified face found. Please try again.");
    return;
  }

  // Check for face recognition result
  CamEvent ev;
  if (camPoll(&ev) && ev.type == CAM_EV_FACE) {
    if (ev.slot < 0) {
      // No match
      previewStatus("Face not recognized. Try again.", COL_ERR);
      camSetMode(CAM_FACE);
    } else if (ev.confidence < FACE_MIN_CONFIDENCE) {
      previewStatus("Low confidence. Reposition face.", COL_ERR);
      camSetMode(CAM_FACE);
    } else if (!g_faceWaiting) {
      g_faceWaiting = true;
      camPreviewOff();
      camSetMode(CAM_IDLE);
      previewStatus("Face matched - verifying...", COL_ACCENT);

      // Submit to backend
      NetRequest req;
      req.type = NET_ATTENDANCE_FACE;
      snprintf(req.payload, sizeof(req.payload),
        "{\"slot\":%d,\"confidence\":%.4f}", ev.slot, ev.confidence);
      g_faceRequestId = netEnqueue(req);
      if (!g_faceRequestId) {
        showResultScreen(false, "System Busy", "Network queue full. Try again.");
      }
    }
  }

  // Check network response
  NetResponse resp;
  if (g_faceWaiting && netDequeueFor(g_faceRequestId, &resp)) {
    if (resp.type == NET_ATTENDANCE_FACE) {
      g_faceWaiting = false;
      if (resp.ok) {
        StaticJsonDocument<384> doc;
        deserializeJson(doc, resp.data);
        const char *name = doc["user"]["name"] | "Unknown";
        const char *role = doc["user"]["role"] | "";
        const char *course = doc["session"]["courseTitle"] | "";
        const char *batch = doc["session"]["batchName"] | "";
        const char *status = doc["status"] | "PRESENT";
        const char *message = doc["message"] | "Attendance marked";
        bool marked = doc["attendance_marked"] | false;

        char title[64], detail[128];
        snprintf(title, sizeof(title), "%s", name);
        snprintf(detail, sizeof(detail), "%s | %s | %s",
          *course ? course : (*batch ? batch : role), status,
          marked ? message : "Already marked");
        showResultScreen(true, title, detail);
      } else if (resp.status == 404) {
        showResultScreen(false, "Unknown Face", "Face slot not registered on this device.");
      } else {
        showNetError(resp);
      }
    }
  }
}

void faceTouch(int16_t x, int16_t y) {
  if (hitTest(kBackBtn, x, y)) {
    camPreviewOff();
    camSetMode(CAM_IDLE);
    popScreen();
  }
}

void faceExit() {
  camPreviewOff();
  camSetMode(CAM_IDLE);
  g_faceWaiting = false;
}

}  // namespace

// ================================================================ SCR_RESULT

namespace {

void resultEnter() {
  g_resultShownAt = millis();
  feedbackSet(g_resultOk ? FB_SUCCESS : FB_ERROR);
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Result");

  // Large status icon area
  const uint16_t iconColor = g_resultOk ? COL_OK : COL_ERR;
  tft.fillCircle(displayWidth() / 2, 70, 20, iconColor);
  tft.setTextSize(3);
  tft.setTextColor(COL_BG);
  tft.setCursor(displayWidth() / 2 - 9, 58);
  tft.print(g_resultOk ? "+" : "!");

  // Title
  tft.setTextSize(2);
  tft.setTextColor(COL_TEXT);
  int16_t titleW = strlen(g_resultTitle) * 12;
  tft.setCursor((displayWidth() - titleW) / 2, 110);
  tft.print(g_resultTitle);

  // Detail
  drawWrappedText(g_resultDetail, 20, 145, 1, COL_MUTED);

  // Tap to dismiss hint
  tft.setTextSize(1);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(90, 220);
  tft.print("Tap anywhere to dismiss");
}

void resultTick() {
  // Auto-dismiss after RESULT_DWELL_MS
  if (millis() - g_resultShownAt > RESULT_DWELL_MS) {
    popScreen();
  }
}

void resultTouch(int16_t, int16_t) {
  popScreen();
}

}  // namespace

// ================================================================ SCR_STATUS

namespace {

// Longer than one HTTP_TIMEOUT_MS round trip plus queueing, so a slow but
// successful request still lands here rather than on the timeout.
const uint32_t kStatusTimeoutMs = HTTP_TIMEOUT_MS * 2 + 4000;
uint32_t g_statusEnteredAt = 0;

void statusEnter() {
  g_statusEnteredAt = millis();
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Verifying...");

  tft.setTextSize(2);
  tft.setTextColor(COL_ACCENT);
  tft.setCursor(80, 100);
  tft.print("Please wait");

  // Spinner animation placeholder
  tft.setTextSize(1);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(80, 140);
  tft.print("Connecting to server...");
}

void statusTick() {
  if (millis() - g_statusEnteredAt > kStatusTimeoutMs) {
    g_statusRequestId = 0;
    showResultScreen(false, "No response", "Server did not reply. Check Home > Status.");
    return;
  }

  // Wait for any pending network response
  NetResponse resp;
  if (g_statusRequestId && netDequeueFor(g_statusRequestId, &resp)) {
    g_statusRequestId = 0;
    if (resp.ok) {
      StaticJsonDocument<384> doc;
      deserializeJson(doc, resp.data);
      const char *name = doc["user"]["name"] | doc["data"]["message"] | "Success";
      const char *msg  = doc["message"] | "Attendance marked";
      showResultScreen(true, name, msg);
    } else {
      if (resp.status <= 0) {
        showNetError(resp);
      } else if (!showRfidRejection(resp)) {
        StaticJsonDocument<256> doc;
        deserializeJson(doc, resp.data);
        const char *err = doc["error"] | "Unknown error";
        const char *msg = doc["message"] | err;
        showResultScreen(false, "Error", msg);
      }
    }
  }
}

}  // namespace

// ========================================================= SCR_DEVICE_STATUS

namespace {

static const UiButton kCheckBtn = {170, 200, 130, 30, "Check server", COL_ACCENT, COL_TEXT, 1};

uint32_t g_devStatusLastDraw = 0;

// One "Label: value" row; the value area is cleared first so repaints
// don't leave stale characters behind.
void statusRow(int16_t y, const char *label, const char *value, uint16_t colour) {
  Adafruit_ILI9341 &tft = getTft();
  tft.setTextSize(1);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(10, y);
  tft.print(label);
  tft.fillRect(90, y, displayWidth() - 90, 8, COL_BG);
  tft.setTextColor(colour);
  tft.setCursor(90, y);
  tft.print(value);
}

void formatAgo(uint32_t sinceMs, char *out, size_t n) {
  const uint32_t s = (millis() - sinceMs) / 1000;
  if (s < 60)        snprintf(out, n, "%lus ago", (unsigned long)s);
  else if (s < 3600) snprintf(out, n, "%lum ago", (unsigned long)(s / 60));
  else               snprintf(out, n, "%luh ago", (unsigned long)(s / 3600));
}

void drawDeviceStatus() {
  char buf[64], ago[16];

  // Wi-Fi
  if (netWifiConnected()) {
    snprintf(buf, sizeof(buf), "%s  (%d dBm)", WIFI_SSID, (int)WiFi.RSSI());
    statusRow(40, "WiFi:", buf, COL_OK);
    statusRow(54, "IP:", WiFi.localIP().toString().c_str(), COL_TEXT);
  } else {
    statusRow(40, "WiFi:", netWifiConnecting() ? "Connecting..." : "Disconnected",
              netWifiConnecting() ? COL_ACCENT : COL_ERR);
    statusRow(54, "IP:", "-", COL_MUTED);
  }

  // Server
  statusRow(68, "Server:", API_BASE_URL, COL_TEXT);
  const NetServerHealth h = netServerHealth();
  if (h.lastCheckMs == 0) {
    statusRow(82, "Link:", netWifiConnected() ? "Checking..." : "Waiting for WiFi", COL_ACCENT);
  } else if (h.lastOkMs == h.lastCheckMs && h.lastStatus == 401) {
    statusRow(82, "Link:", "Rejected: check API_DEVICE_TOKEN", COL_ERR);
  } else if (h.lastOkMs == h.lastCheckMs) {
    formatAgo(h.lastOkMs, ago, sizeof(ago));
    snprintf(buf, sizeof(buf), "Connected (%s)", ago);
    statusRow(82, "Link:", buf, COL_OK);
  } else {
    formatAgo(h.lastCheckMs, ago, sizeof(ago));
    if (h.lastStatus <= 0) snprintf(buf, sizeof(buf), "Unreachable (%s)", ago);
    else                   snprintf(buf, sizeof(buf), "Server error %d (%s)", h.lastStatus, ago);
    statusRow(82, "Link:", buf, COL_ERR);
  }

  // Peripherals
  statusRow(100, "RFID:", nfcReady() ? "Ready" : "Not detected", nfcReady() ? COL_OK : COL_ERR);
  statusRow(114, "Camera:", camIsAlive() ? "Online" : "Offline", camIsAlive() ? COL_OK : COL_ERR);
  {
    CamLinkStats st;
    camGetStats(&st);
    if (st.lastErr[0]) snprintf(buf, sizeof(buf), "err: %.30s", st.lastErr);
    else snprintf(buf, sizeof(buf), "%lu frames ok, %lu bad",
                  (unsigned long)st.framesOk, (unsigned long)st.badFrames);
    statusRow(178, "Cam link:", buf, st.lastErr[0] || st.badFrames ? COL_ERR : COL_TEXT);
  }

  // Sync queue
  const int pending = netPendingCount() + offlineCount();
  snprintf(buf, sizeof(buf), pending ? "%d waiting to sync" : "Up to date", pending);
  statusRow(132, "Sync:", buf, pending ? COL_ACCENT : COL_OK);

  // Uptime / memory
  const uint32_t up = millis() / 1000;
  snprintf(buf, sizeof(buf), "%luh %02lum %02lus", (unsigned long)(up / 3600),
           (unsigned long)(up / 60 % 60), (unsigned long)(up % 60));
  statusRow(150, "Uptime:", buf, COL_TEXT);
  snprintf(buf, sizeof(buf), "%u KB free", (unsigned)(ESP.getFreeHeap() / 1024));
  statusRow(164, "Memory:", buf, COL_TEXT);

  g_devStatusLastDraw = millis();
}

void deviceStatusEnter() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Device Status");
  drawButton(tft, kBackBtn);
  drawButton(tft, kCheckBtn);
  netCheckServerNow();
  drawDeviceStatus();
}

void deviceStatusTick() {
  // Values are live (uptime, "x s ago"), so a 1 s repaint of the value
  // columns is enough and avoids flicker.
  if (millis() - g_devStatusLastDraw >= 1000) drawDeviceStatus();
}

void deviceStatusTouch(int16_t x, int16_t y) {
  if (hitTest(kBackBtn, x, y)) {
    popScreen();
  } else if (hitTest(kCheckBtn, x, y)) {
    netCheckServerNow();
    statusRow(82, "Link:", "Checking...", COL_ACCENT);
  }
}

}  // namespace

// ============================================================= SCR_ARM (legacy)

namespace {

static const UiButton kArmCancelBtn = {100, 190, 120, 30, "Cancel", COL_ERR, COL_TEXT, 1};

void armEnter() {
  g_armEnteredAt = millis();
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Arm Session");

  tft.setTextSize(2);
  tft.setTextColor(COL_TEXT);
  tft.setCursor(30, 80);
  tft.print("Scan trainer QR");
  tft.setTextSize(1);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(30, 110);
  tft.print("Hold QR code towards camera...");

  drawButton(tft, kArmCancelBtn);

  if (!camIsAlive()) {
    tft.setTextSize(1);
    tft.setTextColor(COL_ERR);
    tft.setCursor(30, 150);
    tft.print("WARNING: Camera not responding");
  }
}

void armTick() {
  if (!camIsAlive()) {
    showResultScreen(false, "Camera Error", "Camera not responding.");
    return;
  }

  // Timeout fix for diagnostic #3 — ARM-stuck bug
  if (millis() - g_armEnteredAt > ARM_TIMEOUT_MS) {
    showResultScreen(false, "Camera Timeout", "Camera not responding. Check connection.");
    return;
  }

  CamEvent ev;
  if (camPoll(&ev)) {
    if (ev.type == CAM_EV_QR) {
      // Pass QR content to the attendance flow
      NetRequest req;
      req.type = NET_ATTENDANCE_QR;
      snprintf(req.payload, sizeof(req.payload),
        "{\"scanned_text\":\"%s\"}", ev.text);
      g_statusRequestId = netEnqueue(req);
      if (g_statusRequestId) {
        replaceScreen(SCR_STATUS);
      } else {
        showResultScreen(false, "System Busy", "Network queue full. Try again.");
      }
    }
  }
}

void armTouch(int16_t x, int16_t y) {
  if (hitTest(kArmCancelBtn, x, y)) popScreen();
}

}  // namespace

// ========================================================= SCR_SETTINGS

namespace {

void settingsEnter() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Settings");

  tft.setTextSize(1);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(10, 50);
  tft.print("WiFi: ");
  tft.setTextColor(netWifiConnected() ? COL_OK : netWifiConnecting() ? COL_ACCENT : COL_ERR);
  tft.print(netWifiConnected() ? "Connected" : netWifiConnecting() ? "Connecting..." : "Disconnected");

  tft.setTextColor(COL_MUTED);
  tft.setCursor(10, 70);
  tft.print("Camera: ");
  tft.setTextColor(camIsAlive() ? COL_OK : COL_ERR);
  tft.print(camIsAlive() ? "Online" : "Offline");

  // Backend/sync status — the only other visibility into this today is the
  // generic "Offline Mode" message on SCR_STATUS after a failed request.
  const int pending = netPendingCount() + offlineCount();
  tft.setTextColor(COL_MUTED);
  tft.setCursor(10, 90);
  tft.print("Backend: ");
  if (pending > 0) {
    tft.setTextColor(COL_ACCENT);
    tft.print(pending);
    tft.print(" pending sync");
  } else if (netWifiConnected()) {
    tft.setTextColor(COL_OK);
    tft.print("Up to date");
  } else {
    tft.setTextColor(COL_ERR);
    tft.print("Unreachable");
  }

  tft.setTextColor(COL_MUTED);
  tft.setCursor(10, 110);
  tft.print("FW: CoopSetuTerminal v");
  tft.print(FIRMWARE_VERSION);

  drawButton(tft, kBackBtn);
}

void settingsTouch(int16_t x, int16_t y) {
  if (hitTest(kBackBtn, x, y)) popScreen();
}

}  // namespace

// ======================================================= SCR_ADMIN_LOGIN

namespace {

static const int kPadX = 60, kPadY = 55, kBtnW = 50, kBtnH = 40, kGap = 8;

// Built once from the same x/y math the draw and hit-test used to duplicate
// separately — now there is exactly one source of truth for pad geometry.
void buildPinPadButtons(UiButton out[12]) {
  static const char *kPadLabels[] = {"1","2","3","4","5","6","7","8","9","*","0","#"};
  for (int i = 0; i < 12; i++) {
    int col = i % 3, row = i / 3;
    out[i] = {int16_t(kPadX + col * (kBtnW + kGap)), int16_t(kPadY + row * (kBtnH + kGap)),
               kBtnW, kBtnH, kPadLabels[i], COL_PANEL, COL_TEXT, 2};
  }
}

void pinPadDraw() {
  Adafruit_ILI9341 &tft = getTft();
  UiButton pad[12];
  buildPinPadButtons(pad);
  for (int i = 0; i < 12; i++) drawButton(tft, pad[i]);
}

void pinDisplayUpdate() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillRect(80, 25, 160, 20, COL_BG);
  tft.setTextSize(2);
  tft.setTextColor(COL_ACCENT);
  tft.setCursor(80, 25);
  for (int i = 0; i < g_pinLen; i++) tft.print(g_pinInput[i]);
  for (int i = g_pinLen; i < 4; i++) tft.print('_');
}

void adminLoginEnter() {
  g_pinLen = 0;
  memset(g_pinInput, 0, sizeof(g_pinInput));

  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Admin Login");

  tft.setTextSize(1);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(80, 36);
  tft.print("Enter 4-digit PIN");

  pinDisplayUpdate();
  pinPadDraw();

  drawButton(tft, kBackBtn);
}

void adminLoginTouch(int16_t x, int16_t y) {
  if (hitTest(kBackBtn, x, y)) { popScreen(); return; }

  // Pin pad hit test — built from the exact same geometry pinPadDraw() used.
  UiButton pad[12];
  buildPinPadButtons(pad);
  int i = hitTestArray(pad, 12, x, y);
  if (i < 0) return;

  static const char *kPadLabels[] = {"1","2","3","4","5","6","7","8","9","*","0","#"};

  if (i == 9) {  // '*' = clear
    g_pinLen = 0;
    memset(g_pinInput, 0, sizeof(g_pinInput));
    pinDisplayUpdate();
    return;
  }
  if (i == 11) {  // '#' = submit
    if (g_pinLen == 4) {
      if (strcmp(g_pinInput, g_adminPin) == 0) {
        replaceScreen(SCR_ADMIN_RFID_REGISTER);
      } else {
        showResultScreen(false, "Wrong PIN", "Try again.");
      }
    }
    return;
  }
  // Digit
  if (g_pinLen < 4) {
    g_pinInput[g_pinLen++] = kPadLabels[i][0];
    g_pinInput[g_pinLen] = '\0';
    pinDisplayUpdate();

    // Auto-submit on 4th digit
    if (g_pinLen == 4) {
      delay(200);  // brief visual feedback
      if (strcmp(g_pinInput, g_adminPin) == 0) {
        replaceScreen(SCR_ADMIN_RFID_REGISTER);
      } else {
        g_pinLen = 0;
        memset(g_pinInput, 0, sizeof(g_pinInput));
        pinDisplayUpdate();
        Adafruit_ILI9341 &tft = getTft();
        tft.fillRect(80, 10, 200, 12, COL_BG);
        tft.setTextSize(1);
        tft.setTextColor(COL_ERR);
        tft.setCursor(80, 10);
        tft.print("Wrong PIN. Try again.");
      }
    }
  }
}

}  // namespace

// ================================================= SCR_ADMIN_RFID_REGISTER

namespace {

static const UiButton kConfirmBtn = {60, 130, 200, 40, "CONFIRM", COL_OK, COL_TEXT, 2};

static const UiButton kRoleBtns[] = {
  {20,  60, 130, 35, "Trainee",  COL_ACCENT, COL_TEXT, 1},
  {160, 60, 130, 35, "Trainer",  COL_ACCENT, COL_TEXT, 1},
  {80, 110, 160, 35, "Employee", COL_ACCENT, COL_TEXT, 1},
};

void regDrawStep() {
  Adafruit_ILI9341 &tft = getTft();
  fillContentArea();
  drawButton(tft, kBackBtn);

  switch (g_regStep) {
    case 0: {
      tft.setTextSize(1);
      tft.setTextColor(COL_TEXT);
      tft.setCursor(20, 40);
      tft.print("Step 1: Select Role");
      for (int i = 0; i < 3; i++) drawButton(tft, kRoleBtns[i]);
      break;
    }
    case 1: {
      tft.setTextSize(1);
      tft.setTextColor(COL_TEXT);
      tft.setCursor(20, 40);
      tft.print("Step 2: Fetching institutions...");
      // netTask will deliver the response
      break;
    }
    case 2: {
      tft.setTextSize(1);
      tft.setTextColor(COL_TEXT);
      tft.setCursor(20, 40);
      tft.print("Step 3: Searching users...");
      break;
    }
    case 3: {
      tft.setTextSize(1);
      tft.setTextColor(COL_TEXT);
      tft.setCursor(20, 40);
      tft.print("Step 4: Scan RFID Card");
      tft.setTextSize(2);
      tft.setTextColor(COL_ACCENT);
      tft.setCursor(20, 70);
      tft.print("For: ");
      tft.print(g_regUserName);
      tft.setTextSize(1);
      tft.setTextColor(COL_MUTED);
      tft.setCursor(20, 100);
      tft.print("Hold card near reader...");
      break;
    }
    case 4: {
      tft.setTextSize(1);
      tft.setTextColor(COL_TEXT);
      tft.setCursor(20, 40);
      tft.print("Step 5: Confirm Registration");
      tft.setTextSize(1);
      tft.setCursor(20, 60);
      tft.print("User: ");
      tft.print(g_regUserName);
      tft.setCursor(20, 75);
      tft.print("Role: ");
      tft.print(g_regRole);
      tft.setCursor(20, 90);
      tft.print("RFID: ");
      tft.print(g_regRfidUid);

      drawButton(tft, kConfirmBtn);
      break;
    }
  }
}

void adminRegEnter() {
  if (g_regResume) {
    g_regResume = false;
    Adafruit_ILI9341 &tft = getTft();
    tft.fillScreen(COL_BG);
    drawHeader("RFID Registration");
    regDrawStep();
    return;
  }
  g_regStep = 0;
  memset(g_regRole, 0, sizeof(g_regRole));
  memset(g_regRfidUid, 0, sizeof(g_regRfidUid));
  memset(g_regCardCredential, 0, sizeof(g_regCardCredential));

  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("RFID Registration");
  regDrawStep();
}

void adminRegTick() {
  if (g_regStep == 3) {
    // Wait for an RFID card scan
    NfcCard card;
    if (nfcPoll(&card)) {
      if (!card.credential[0] && !nfcProvisionCredential(&card)) {
        showResultScreen(false, "Card Error", "Use a writable NTAG213/215/216 card.");
        return;
      }
      strncpy(g_regRfidUid, card.uid, sizeof(g_regRfidUid) - 1);
      strncpy(g_regCardCredential, card.credential, sizeof(g_regCardCredential) - 1);
      g_regStep = 4;
      regDrawStep();
    }
  }

  // Check for network responses at any step
  NetResponse resp;
  if (g_adminRequestId && netDequeueFor(g_adminRequestId, &resp)) {
    g_adminRequestId = 0;
    if (resp.type == NET_RFID_REGISTER && g_regStep == 4) {
      if (resp.ok) {
        showResultScreen(true, "Registered!", "RFID card linked successfully.");
      } else {
        showResultScreen(false, "Failed", resp.data);
      }
    }
  }
}

void adminRegTouch(int16_t x, int16_t y) {
  if (hitTest(kBackBtn, x, y)) { popScreen(); return; }

  if (g_regStep == 0) {
    int idx = hitTestArray(kRoleBtns, 3, x, y);
    if (idx >= 0) {
      const char *roles[] = {"TRAINEE", "TRAINER", "EMPLOYEE"};
      strncpy(g_regRole, roles[idx], sizeof(g_regRole) - 1);
      g_regUserOffset = 0;
      NetRequest req;
      req.type = NET_USER_SEARCH;
      snprintf(req.payload, sizeof(req.payload),
               "role=%s&limit=%u&offset=0&compact=1", g_regRole, NET_USER_PAGE_SIZE);
      g_userPageRequestId = netEnqueue(req);
      replaceScreen(SCR_ADMIN_USER_LIST);
    }
  } else if (g_regStep == 4) {
    // Confirm button
    if (hitTest(kConfirmBtn, x, y)) {
      // Submit registration
      NetRequest req;
      req.type = NET_RFID_REGISTER;
      snprintf(req.payload, sizeof(req.payload),
        "{\"rfid_uid\":\"%s\",\"member_id\":\"%s\",\"card_credential\":\"%s\"}",
        g_regRfidUid, g_regUserId, g_regCardCredential);
      g_adminRequestId = netEnqueue(req);

      Adafruit_ILI9341 &tft = getTft();
      tft.fillRect(60, 180, 200, 20, COL_BG);
      tft.setTextSize(1);
      tft.setTextColor(COL_ACCENT);
      tft.setCursor(80, 185);
      tft.print("Registering...");
    }
  }
}

}  // namespace

// ===================================================== SCR_ADMIN_USER_LIST

namespace {

static const UiButton kUserPrevBtn = {105, 205, 95, 28, "Prev", COL_PANEL, COL_TEXT, 1};
static const UiButton kUserNextBtn = {210, 205, 95, 28, "Next", COL_ACCENT, COL_TEXT, 1};
bool g_userPageWaiting = true;

void drawUserPage(bool loading = false) {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillRect(0, 30, displayWidth(), 170, COL_BG);
  tft.setTextSize(1);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(12, 34);
  if (loading) {
    tft.print("Loading members...");
  } else if (netUserPageCount() == 0) {
    tft.print("No members found for this role.");
  } else {
    for (uint8_t index = 0; index < netUserPageCount(); index++) {
      const NetUserPageEntry *entry = netUserPageEntry(index);
      const int16_t y = 34 + index * 27;
      tft.drawRect(10, y, 300, 23, COL_MUTED);
      tft.setTextColor(COL_TEXT);
      tft.setCursor(16, y + 7);
      tft.print(entry->name);
      if (entry->hasRfid) {
        tft.setTextColor(COL_OK);
        tft.setCursor(270, y + 7);
        tft.print("RFID");
      }
    }
  }

  char page[32];
  const int first = netUserPageCount() ? netUserPageOffset() + 1 : 0;
  const int last = netUserPageOffset() + netUserPageCount();
  snprintf(page, sizeof(page), "%d-%d of %d", first, last, netUserPageTotal());
  tft.fillRect(8, 205, 90, 28, COL_BG);
  tft.setTextColor(COL_MUTED);
  tft.setCursor(12, 215);
  tft.print(page);
  drawButton(tft, kUserPrevBtn);
  drawButton(tft, kUserNextBtn);
}

void requestUserPage(int offset) {
  g_regUserOffset = max(0, offset);
  NetRequest req;
  req.type = NET_USER_SEARCH;
  snprintf(req.payload, sizeof(req.payload),
           "role=%s&limit=%u&offset=%d&compact=1", g_regRole,
           NET_USER_PAGE_SIZE, g_regUserOffset);
  g_userPageRequestId = netEnqueue(req);
  g_userPageWaiting = g_userPageRequestId != 0;
  drawUserPage(true);
}

void adminUserListEnter() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Select Member");
  drawButton(tft, kBackBtn);
  g_userPageWaiting = true;
  drawUserPage(true);
}

void adminUserListTick() {
  NetResponse resp;
  if (!g_userPageRequestId || !netDequeueFor(g_userPageRequestId, &resp)) return;
  g_userPageRequestId = 0;
  if (resp.type != NET_USER_SEARCH) return;
  g_userPageWaiting = false;
  if (resp.ok) drawUserPage();
  else showNetError(resp);
}

void adminUserListTouch(int16_t x, int16_t y) {
  if (hitTest(kBackBtn, x, y)) {
    replaceScreen(SCR_ADMIN_RFID_REGISTER);
    return;
  }
  if (g_userPageWaiting) return;
  if (hitTest(kUserPrevBtn, x, y) && netUserPageOffset() > 0) {
    requestUserPage(netUserPageOffset() - NET_USER_PAGE_SIZE);
    return;
  }
  if (hitTest(kUserNextBtn, x, y) && netUserPageHasMore()) {
    requestUserPage(netUserPageOffset() + NET_USER_PAGE_SIZE);
    return;
  }
  if (x >= 10 && x <= 310 && y >= 34 && y < 34 + NET_USER_PAGE_SIZE * 27) {
    const uint8_t index = (y - 34) / 27;
    const NetUserPageEntry *entry = netUserPageEntry(index);
    if (!entry) return;
    strncpy(g_regUserId, entry->id, sizeof(g_regUserId) - 1);
    g_regUserId[sizeof(g_regUserId) - 1] = '\0';
    strncpy(g_regUserName, entry->name, sizeof(g_regUserName) - 1);
    g_regUserName[sizeof(g_regUserName) - 1] = '\0';
    g_regStep = 3;
    g_regResume = true;
    replaceScreen(SCR_ADMIN_RFID_REGISTER);
  }
}

}  // namespace

// ====================================================== SCR_CAMERA_PREVIEW

namespace {

void previewEnter() {
  beginPreviewScreen("Camera Preview", "Tap anywhere to close", GUIDE_NONE);
  camPreviewOn();
}

void previewTick() {
  drawPreviewFrame();
}

void previewTouch(int16_t, int16_t) {
  camPreviewOff();
  popScreen();
}

void previewExit() {
  camPreviewOff();
}

}  // namespace

// ========================================================= Registration table

// This must be called AFTER screensBegin() — typically from setup().
// It wires all screen handlers into the g_screens table.
void screensRegister() {
  // Preview JPEGs are decoded straight onto the panel, one block at a time.
  // 1:1 scale: the CAM's QVGA frame is exactly the panel's 320x240.
  TJpgDec.setJpgScale(1);
  TJpgDec.setSwapBytes(PREVIEW_SWAP_BYTES);
  TJpgDec.setCallback(tftJpegBlock);

  // HOME
  g_screens[SCR_HOME].onEnter = homeEnter;
  g_screens[SCR_HOME].onTick  = homeTick;
  g_screens[SCR_HOME].onTouch = homeTouch;

  // ATTENDANCE MENU
  g_screens[SCR_ATTENDANCE_MENU].onEnter = menuEnter;
  g_screens[SCR_ATTENDANCE_MENU].onTouch = menuTouch;

  // RFID
  g_screens[SCR_RFID].onEnter = rfidEnter;
  g_screens[SCR_RFID].onTick  = rfidTick;
  g_screens[SCR_RFID].onTouch = rfidTouch;

  // QR
  g_screens[SCR_QR].onEnter = qrEnter;
  g_screens[SCR_QR].onTick  = qrTick;
  g_screens[SCR_QR].onTouch = qrTouch;
  g_screens[SCR_QR].onExit  = qrExit;

  // FACE
  g_screens[SCR_FACE].onEnter = faceEnter;
  g_screens[SCR_FACE].onTick  = faceTick;
  g_screens[SCR_FACE].onTouch = faceTouch;
  g_screens[SCR_FACE].onExit  = faceExit;

  // CAMERA PREVIEW
  g_screens[SCR_CAMERA_PREVIEW].onEnter = previewEnter;
  g_screens[SCR_CAMERA_PREVIEW].onTick  = previewTick;
  g_screens[SCR_CAMERA_PREVIEW].onTouch = previewTouch;
  g_screens[SCR_CAMERA_PREVIEW].onExit  = previewExit;

  // STATUS (waiting spinner)
  g_screens[SCR_STATUS].onEnter = statusEnter;
  g_screens[SCR_STATUS].onTick  = statusTick;

  // SETTINGS
  g_screens[SCR_SETTINGS].onEnter = settingsEnter;
  g_screens[SCR_SETTINGS].onTouch = settingsTouch;

  // ADMIN LOGIN (PIN pad)
  g_screens[SCR_ADMIN_LOGIN].onEnter = adminLoginEnter;
  g_screens[SCR_ADMIN_LOGIN].onTouch = adminLoginTouch;

  // ADMIN RFID REGISTER
  g_screens[SCR_ADMIN_RFID_REGISTER].onEnter = adminRegEnter;
  g_screens[SCR_ADMIN_RFID_REGISTER].onTick  = adminRegTick;
  g_screens[SCR_ADMIN_RFID_REGISTER].onTouch = adminRegTouch;

  // ADMIN USER LIST
  g_screens[SCR_ADMIN_USER_LIST].onEnter = adminUserListEnter;
  g_screens[SCR_ADMIN_USER_LIST].onTick  = adminUserListTick;
  g_screens[SCR_ADMIN_USER_LIST].onTouch = adminUserListTouch;

  // RESULT
  g_screens[SCR_RESULT].onEnter = resultEnter;
  g_screens[SCR_RESULT].onTick  = resultTick;
  g_screens[SCR_RESULT].onTouch = resultTouch;

  // DEVICE STATUS (diagnostics)
  g_screens[SCR_DEVICE_STATUS].onEnter = deviceStatusEnter;
  g_screens[SCR_DEVICE_STATUS].onTick  = deviceStatusTick;
  g_screens[SCR_DEVICE_STATUS].onTouch = deviceStatusTouch;

  // ARM (legacy session-arm flow)
  g_screens[SCR_ARM].onEnter = armEnter;
  g_screens[SCR_ARM].onTick  = armTick;
  g_screens[SCR_ARM].onTouch = armTouch;
}
