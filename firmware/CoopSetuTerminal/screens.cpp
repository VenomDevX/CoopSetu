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
int  g_regStep = 0;    // 0=role, 1=institution, 2=user, 3=scan, 4=confirm
char g_regRole[16]  = {0};
char g_regInstId[40] = {0};
char g_regInstName[48] = {0};
char g_regUserId[40]   = {0};
char g_regUserName[64] = {0};
char g_regRfidUid[21]  = {0};
char g_regOrgId[40]    = {0};

// ARM screen state
uint32_t g_armEnteredAt = 0;

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
      "{\"rfid_uid\":\"%s\"}", card.uid);
    if (netEnqueue(req)) {
      replaceScreen(SCR_STATUS);
    } else {
      showResultScreen(false, "System Busy", "Network queue full. Try again.");
    }
  }

  // Check for network responses
  NetResponse resp;
  if (netDequeue(&resp)) {
    if (resp.type == NET_ATTENDANCE_RFID) {
      if (resp.ok) {
        // Parse user name from response
        StaticJsonDocument<384> doc;
        deserializeJson(doc, resp.data);
        const char *name = doc["user"]["name"] | "Unknown";
        const char *role = doc["user"]["role"] | "";
        bool marked = doc["attendance_marked"] | false;

        char title[64], detail[128];
        if (marked) {
          snprintf(title, sizeof(title), "%s", name);
          snprintf(detail, sizeof(detail), "%s — Attendance Marked", role);
        } else {
          snprintf(title, sizeof(title), "%s", name);
          snprintf(detail, sizeof(detail), "%s — Already Marked", role);
        }
        showResultScreen(true, title, detail);
      } else if (resp.status == 404) {
        showResultScreen(false, "Unknown RFID", "Card not registered");
      } else {
        showResultScreen(false, "Error", resp.data);
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
    case 3: pushScreen(SCR_STATUS);          break;
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
      "{\"rfid_uid\":\"%s\"}", card.uid);
    if (!netEnqueue(req)) {
      showResultScreen(false, "System Busy", "Network queue full. Try again.");
    }
  }

  // Check response
  NetResponse resp;
  while (netDequeue(&resp)) {
    if (g_rfidWaiting && resp.type == NET_ATTENDANCE_RFID) {
      g_rfidWaiting = false;
      if (resp.ok) {
        StaticJsonDocument<384> doc;
        deserializeJson(doc, resp.data);
        const char *name = doc["user"]["name"] | "Unknown";
        const char *role = doc["user"]["role"] | "";
        bool marked = doc["attendance_marked"] | false;

        char title[64], detail[128];
        if (marked) {
          snprintf(title, sizeof(title), "%s", name);
          snprintf(detail, sizeof(detail), "%s — Attendance Marked", role);
        } else {
          snprintf(title, sizeof(title), "%s", name);
          snprintf(detail, sizeof(detail), "Already marked today");
        }
        showResultScreen(true, title, detail);
      } else if (resp.status == 404) {
        showResultScreen(false, "Unknown RFID", "Card not registered. Contact admin.");
      } else if (resp.status == 403) {
        showResultScreen(false, "Card Revoked", "This card has been deactivated.");
      } else {
        showResultScreen(false, "Error", resp.data);
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

void qrEnter() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("QR Attendance");

  tft.setTextSize(2);
  tft.setTextColor(COL_TEXT);
  tft.setCursor(30, 60);
  tft.print("Point QR at camera");

  drawButton(tft, kBackBtn);

  camSetMode(CAM_QR);
  camPreviewOn();
}

void qrTick() {
  if (!camIsAlive()) {
    showResultScreen(false, "Camera Error", "Camera not responding.");
    return;
  }

  // Blit preview frame if available
  if (camHasFrame()) {
    uint8_t frame[PREVIEW_WIDTH * PREVIEW_HEIGHT];
    uint16_t w, h;
    if (camGetFrame(frame, &w, &h)) {
      Adafruit_ILI9341 &tft = getTft();
      // Draw scaled 2x into a 192x144 region centered
      const int16_t ox = (displayWidth() - w * 2) / 2;
      const int16_t oy = 80;
      for (uint16_t py = 0; py < h; py++) {
        for (uint16_t px = 0; px < w; px++) {
          uint8_t g = frame[py * w + px];
          uint16_t c = ((g >> 3) << 11) | ((g >> 2) << 5) | (g >> 3);
          tft.fillRect(ox + px * 2, oy + py * 2, 2, 2, c);
        }
      }
    }
  }

  // Check for QR decode result from CAM
  CamEvent ev;
  if (camPoll(&ev) && ev.type == CAM_EV_QR) {
    camPreviewOff();
    camSetMode(CAM_IDLE);

    // Format depends on whether it's a session QR or a TOTP QR
    // Session QR: just the qr_token
    // TOTP QR: coopsetu:TRAINEE_ID:TOTP_CODE
    NetRequest req;
    if (strncmp(ev.text, "coopsetu:", 9) == 0) {
      req.type = NET_ATTENDANCE_QR;
      snprintf(req.payload, sizeof(req.payload),
        "{\"scanned_text\":\"%s\"}", ev.text);
    } else {
      req.type = NET_ATTENDANCE_QR;
      snprintf(req.payload, sizeof(req.payload),
        "{\"qr_token\":\"%s\"}", ev.text);
    }
    if (netEnqueue(req)) {
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

void faceEnter() {
  g_faceWaiting = false;
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Face ID");

  tft.setTextSize(2);
  tft.setTextColor(COL_TEXT);
  tft.setCursor(30, 60);
  tft.print("Position your face");

  drawButton(tft, kBackBtn);

  camSetMode(CAM_FACE);
  camPreviewOn();
}

void faceTick() {
  if (!camIsAlive()) {
    showResultScreen(false, "Camera Error", "Camera not responding.");
    return;
  }

  // Blit preview
  if (camHasFrame()) {
    uint8_t frame[PREVIEW_WIDTH * PREVIEW_HEIGHT];
    uint16_t w, h;
    if (camGetFrame(frame, &w, &h)) {
      Adafruit_ILI9341 &tft = getTft();
      const int16_t ox = (displayWidth() - w * 2) / 2;
      const int16_t oy = 80;
      for (uint16_t py = 0; py < h; py++) {
        for (uint16_t px = 0; px < w; px++) {
          uint8_t g = frame[py * w + px];
          uint16_t c = ((g >> 3) << 11) | ((g >> 2) << 5) | (g >> 3);
          tft.fillRect(ox + px * 2, oy + py * 2, 2, 2, c);
        }
      }
    }
  }

  // Check for face recognition result
  CamEvent ev;
  if (camPoll(&ev) && ev.type == CAM_EV_FACE) {
    if (ev.slot < 0) {
      // No match
      Adafruit_ILI9341 &tft = getTft();
      tft.fillRect(0, 200, displayWidth(), 20, COL_BG);
      tft.setTextSize(1);
      tft.setTextColor(COL_ERR);
      tft.setCursor(60, 205);
      tft.print("Face not recognized. Try again.");
    } else if (ev.confidence < FACE_MIN_CONFIDENCE) {
      Adafruit_ILI9341 &tft = getTft();
      tft.fillRect(0, 200, displayWidth(), 20, COL_BG);
      tft.setTextSize(1);
      tft.setTextColor(COL_ERR);
      tft.setCursor(60, 205);
      tft.print("Low confidence. Reposition face.");
    } else if (!g_faceWaiting) {
      g_faceWaiting = true;
      camPreviewOff();
      camSetMode(CAM_IDLE);

      // Submit to backend
      NetRequest req;
      req.type = NET_ATTENDANCE_FACE;
      snprintf(req.payload, sizeof(req.payload),
        "{\"slot\":%d,\"confidence\":%.4f}", ev.slot, ev.confidence);
      if (!netEnqueue(req)) {
        showResultScreen(false, "System Busy", "Network queue full. Try again.");
      }
    }
  }

  // Check network response
  NetResponse resp;
  while (netDequeue(&resp)) {
    if (g_faceWaiting && resp.type == NET_ATTENDANCE_FACE) {
      g_faceWaiting = false;
      if (resp.ok) {
        StaticJsonDocument<384> doc;
        deserializeJson(doc, resp.data);
        const char *name = doc["user"]["name"] | "Unknown";
        const char *role = doc["user"]["role"] | "";
        bool marked = doc["attendance_marked"] | false;

        char title[64], detail[128];
        snprintf(title, sizeof(title), "%s", name);
        snprintf(detail, sizeof(detail), "%s — %s",
          role, marked ? "Attendance Marked" : "Already Marked");
        showResultScreen(true, title, detail);
      } else if (resp.status == 404) {
        showResultScreen(false, "Unknown Face", "Face slot not registered on this device.");
      } else {
        showResultScreen(false, "Error", resp.data);
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

void statusEnter() {
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
  // Wait for any pending network response
  NetResponse resp;
  if (netDequeue(&resp)) {
    if (resp.ok) {
      StaticJsonDocument<384> doc;
      deserializeJson(doc, resp.data);
      const char *name = doc["user"]["name"] | doc["data"]["message"] | "Success";
      const char *msg  = doc["message"] | "Attendance marked";
      showResultScreen(true, name, msg);
    } else {
      if (resp.status <= 0 && (resp.type == NET_ATTENDANCE_RFID || resp.type == NET_ATTENDANCE_QR || resp.type == NET_ATTENDANCE_FACE)) {
        showResultScreen(true, "Offline Mode", "Stored locally, will sync when online.");
      } else {
        StaticJsonDocument<256> doc;
        deserializeJson(doc, resp.data);
        const char *err = doc["error"] | "Unknown error";
        
        if (strcmp(err, "unknown_rfid") == 0) {
          const char *uid = doc["rfid_uid"] | "Unknown";
          char msg[128];
          snprintf(msg, sizeof(msg), "Card %s not registered. Contact administrator.", uid);
          showResultScreen(false, "Unknown RFID", msg);
        } else if (strcmp(err, "card_revoked") == 0) {
          showResultScreen(false, "Card Revoked", "This card has been deactivated.");
        } else {
          const char *msg = doc["message"] | err;
          showResultScreen(false, "Error", msg);
        }
      }
    }
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
      if (netEnqueue(req)) {
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
  tft.print("FW: CoopSetuTerminal v2.0");

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
  g_regStep = 0;
  memset(g_regRole, 0, sizeof(g_regRole));
  memset(g_regRfidUid, 0, sizeof(g_regRfidUid));

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
      strncpy(g_regRfidUid, card.uid, sizeof(g_regRfidUid) - 1);
      g_regStep = 4;
      regDrawStep();
    }
  }

  // Check for network responses at any step
  NetResponse resp;
  if (netDequeue(&resp)) {
    if (resp.type == NET_FETCH_INSTITUTIONS && g_regStep == 1) {
      // For simplicity, skip institution selection (use first found)
      // In a real implementation this would show a scrollable list
      g_regStep = 2;

      // Fetch users for this role
      NetRequest req;
      req.type = NET_USER_SEARCH;
      snprintf(req.payload, sizeof(req.payload),
        "role=%s&limit=10", g_regRole);
      netEnqueue(req);
      regDrawStep();
    }
    if (resp.type == NET_USER_SEARCH && g_regStep == 2) {
      if (resp.ok) {
        // Parse first user from results
        StaticJsonDocument<384> doc;
        deserializeJson(doc, resp.data);
        JsonArray users = doc["users"];
        if (users.size() > 0) {
          strncpy(g_regUserId, users[0]["id"] | "", sizeof(g_regUserId) - 1);
          strncpy(g_regUserName, users[0]["name"] | "Unknown", sizeof(g_regUserName) - 1);
          strncpy(g_regOrgId, users[0]["organization_id"] | "", sizeof(g_regOrgId) - 1);
        }
      }
      g_regStep = 3;
      regDrawStep();
    }
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
      g_regStep = 1;

      // Fetch institutions
      NetRequest req;
      req.type = NET_FETCH_INSTITUTIONS;
      snprintf(req.payload, sizeof(req.payload), "limit=20");
      netEnqueue(req);

      regDrawStep();
    }
  } else if (g_regStep == 4) {
    // Confirm button
    if (hitTest(kConfirmBtn, x, y)) {
      // Submit registration
      NetRequest req;
      req.type = NET_RFID_REGISTER;
      snprintf(req.payload, sizeof(req.payload),
        "{\"rfid_uid\":\"%s\",\"member_id\":\"%s\",\"organization_id\":\"%s\"}",
        g_regRfidUid, g_regUserId, g_regOrgId);
      netEnqueue(req);

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

// ====================================================== SCR_CAMERA_PREVIEW

namespace {

void previewEnter() {
  Adafruit_ILI9341 &tft = getTft();
  tft.fillScreen(COL_BG);
  drawHeader("Camera Preview");
  camPreviewOn();
}

void previewTick() {
  if (camHasFrame()) {
    uint8_t frame[PREVIEW_WIDTH * PREVIEW_HEIGHT];
    uint16_t w, h;
    if (camGetFrame(frame, &w, &h)) {
      Adafruit_ILI9341 &tft = getTft();
      const int16_t ox = (displayWidth() - w * 2) / 2;
      const int16_t oy = 50;
      for (uint16_t py = 0; py < h; py++) {
        for (uint16_t px = 0; px < w; px++) {
          uint8_t g = frame[py * w + px];
          uint16_t c = ((g >> 3) << 11) | ((g >> 2) << 5) | (g >> 3);
          tft.fillRect(ox + px * 2, oy + py * 2, 2, 2, c);
        }
      }
    }
  }
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

  // RESULT
  g_screens[SCR_RESULT].onEnter = resultEnter;
  g_screens[SCR_RESULT].onTick  = resultTick;
  g_screens[SCR_RESULT].onTouch = resultTouch;

  // ARM (legacy session-arm flow)
  g_screens[SCR_ARM].onEnter = armEnter;
  g_screens[SCR_ARM].onTick  = armTick;
  g_screens[SCR_ARM].onTouch = armTouch;
}
