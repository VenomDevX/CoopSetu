// CoopSetu attendance terminal — ESP32 38-pin devkit.
//
// Wiring is transcribed from Hardware.md into config.h; read the notes there
// before powering up, especially the two resistor values that are wrong in the
// parts list.
//
// Flow:
//   1. ARM      the trainer opens the session QR on the CoopSetu dashboard and
//               holds it to the camera. The terminal stores the qr_token.
//   2. IDENTIFY a trainee taps an NFC card, or presses the button for a face
//               check-in. Either way the result is a trainee id.
//   3. SUBMIT   POST /api/v1/attendance/qr { qr_token, trainee_id }.
//
// The token is held by the terminal rather than scanned per trainee, because
// that is what the existing endpoint expects: one session token, many trainees.
//
// Face matching happens entirely on the ESP32-CAM. The terminal never sees an
// embedding — it receives a slot number and maps it to a trainee id. See
// firmware/README.md for why the embeddings cannot be sent to the server.

#include <Arduino.h>
#include <Preferences.h>

#include "config.h"
#include "feedback.h"
#include "display.h"
#include "nfc.h"
#include "camlink.h"
#include "api.h"

// --------------------------------------------------------------- face roster
// Maps an on-CAM face slot to a CoopSetu trainee id. Enrol with the serial
// command `enrol <slot> <trainee-uuid>` (see handleSerial), which is how a
// trainer registers a face without a keyboard on the terminal.
struct FaceSlot {
  char trainee[64];
};
static const int kMaxFaces = 16;
static FaceSlot g_faces[kMaxFaces];

Preferences g_prefs;

enum State { S_BOOT, S_ARM, S_IDLE, S_IDENTIFY, S_SUBMIT, S_RESULT };
State g_state = S_BOOT;
uint32_t g_stateSince = 0;

char g_qrToken[192] = {0};
uint32_t g_qrArmedAt = 0;
int g_markedCount = 0;

int g_enrollSlot = -1;  // >= 0 while an enrolment is in flight

// ---------------------------------------------------------------- persistence
void loadState() {
  g_prefs.begin("coopsetu", false);
  g_prefs.getString("qr", g_qrToken, sizeof(g_qrToken));
  g_markedCount = g_prefs.getInt("marked", 0);

  // The token survives a reboot but its age cannot: millis() restarts at 0 and
  // there is no RTC, so elapsed wall-clock time across a power cycle is simply
  // unknowable. Restart the local TTL clock and let the server be authoritative
  // on expiry - markAttendanceByQR() checks qr_expires_at and returns
  // "QR code has expired", which submitFor() turns into a re-arm. Persisting
  // the old timestamp instead would make millis() - g_qrArmedAt underflow and
  // expire every restored session immediately.
  g_qrArmedAt = millis();
  for (int i = 0; i < kMaxFaces; i++) {
    char key[8];
    snprintf(key, sizeof(key), "f%d", i);
    g_prefs.getString(key, g_faces[i].trainee, sizeof(g_faces[i].trainee));
  }
}

void saveSession() {
  g_prefs.putString("qr", g_qrToken);
  g_prefs.putInt("marked", g_markedCount);
}

void saveFace(int slot) {
  char key[8];
  snprintf(key, sizeof(key), "f%d", slot);
  g_prefs.putString(key, g_faces[slot].trainee);
}

bool sessionValid() {
  if (g_qrToken[0] == '\0') return false;
  // millis() wraps after ~49 days; the unsigned subtraction handles that.
  return (millis() - g_qrArmedAt) < QR_SESSION_TTL_MS;
}

// -------------------------------------------------------------------- states
void enter(State s) {
  g_state = s;
  g_stateSince = millis();

  switch (s) {
    case S_ARM:
      camSetMode(CAM_QR);
      screenArmSession();
      feedbackSet(FB_WAITING);
      break;
    case S_IDLE: {
      camSetMode(CAM_IDLE);
      char label[24];
      // Never render the whole token: it is a bearer credential for the session
      // and the terminal is, by design, mounted somewhere public.
      snprintf(label, sizeof(label), "%.4s...", g_qrToken);
      screenIdle(label, g_markedCount);
      feedbackSet(FB_WAITING);
      break;
    }
    case S_IDENTIFY:
      camSetMode(CAM_FACE);
      screenBusy("Look at camera");
      feedbackSet(FB_BUSY);
      break;
    case S_SUBMIT:
      screenBusy("Marking...");
      feedbackSet(FB_BUSY);
      break;
    default:
      break;
  }
}

void showResult(bool ok, const char *title, const char *detail) {
  screenResult(ok, title, detail);
  feedbackSet(ok ? FB_SUCCESS : FB_FAILURE);
  g_state = S_RESULT;
  g_stateSince = millis();
}

void submitFor(const char *traineeId) {
  enter(S_SUBMIT);
  const ApiResult r = apiMarkAttendance(g_qrToken, traineeId);
  if (r.ok) {
    g_markedCount++;
    saveSession();
    showResult(true, "Marked", traineeId);
  } else {
    showResult(false, "Rejected", r.message);
    // The server owns expiry. If it says the token is dead, stop retrying it -
    // otherwise every subsequent tap fails the same way with no path out.
    if (strstr(r.message, "expired") || strstr(r.message, "Invalid")) {
      g_qrToken[0] = '\0';
      saveSession();
    }
  }
}

// --------------------------------------------------------------------- button
bool buttonDown() {
#if BUTTON_ACTIVE_LOW
  return digitalRead(PIN_BUTTON) == LOW;
#else
  return digitalRead(PIN_BUTTON) == HIGH;
#endif
}

// Returns 1 on a short press, 2 on a long press, 0 otherwise. Debounced.
int buttonEvent() {
  static bool was = false;
  static uint32_t downAt = 0;
  static bool longFired = false;

  const bool now = buttonDown();

  if (now && !was) {
    downAt = millis();
    longFired = false;
  }
  if (now && !longFired && millis() - downAt > BUTTON_LONG_PRESS_MS) {
    longFired = true;
    was = now;
    return 2;
  }
  if (!now && was) {
    was = now;
    if (!longFired && millis() - downAt > 40) return 1;
    return 0;
  }
  was = now;
  return 0;
}

// -------------------------------------------------- serial admin (enrolment)
// Typed into the Arduino IDE serial monitor at 115200:
//   enrol <slot> <trainee-uuid>   bind a slot, then capture the face
//   forget <slot>                 clear a slot (255 = all)
//   session                       re-arm the session QR
//   status                        print current state
void handleSerial() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.isEmpty()) return;

  if (line.startsWith("enrol")) {
    const int sp1 = line.indexOf(' ');
    const int sp2 = line.indexOf(' ', sp1 + 1);
    if (sp1 < 0 || sp2 < 0) {
      Serial.println("usage: enrol <slot> <trainee-uuid>");
      return;
    }
    const int slot = line.substring(sp1 + 1, sp2).toInt();
    if (slot < 0 || slot >= kMaxFaces) {
      Serial.printf("slot must be 0..%d\n", kMaxFaces - 1);
      return;
    }
    const String uuid = line.substring(sp2 + 1);
    strncpy(g_faces[slot].trainee, uuid.c_str(), sizeof(g_faces[slot].trainee) - 1);
    g_faces[slot].trainee[sizeof(g_faces[slot].trainee) - 1] = '\0';
    saveFace(slot);

    g_enrollSlot = slot;
    camSetMode(CAM_FACE);
    camEnroll(slot);
    screenEnroll(uuid.c_str(), slot);
    Serial.printf("capturing face for slot %d...\n", slot);
    return;
  }

  if (line.startsWith("forget")) {
    const int sp = line.indexOf(' ');
    const int slot = sp > 0 ? line.substring(sp + 1).toInt() : -1;
    if (slot == 255) {
      for (int i = 0; i < kMaxFaces; i++) {
        g_faces[i].trainee[0] = '\0';
        saveFace(i);
      }
    } else if (slot >= 0 && slot < kMaxFaces) {
      g_faces[slot].trainee[0] = '\0';
      saveFace(slot);
    } else {
      Serial.println("usage: forget <slot|255>");
      return;
    }
    camForget(slot);
    Serial.println("ok");
    return;
  }

  if (line == "session") {
    enter(S_ARM);
    return;
  }

  if (line == "status") {
    Serial.printf("wifi=%d cam=%d session=%s marked=%d\n", wifiIsUp(),
                  camIsAlive(), sessionValid() ? "armed" : "none", g_markedCount);
    for (int i = 0; i < kMaxFaces; i++) {
      if (g_faces[i].trainee[0]) Serial.printf("  slot %d -> %s\n", i, g_faces[i].trainee);
    }
    return;
  }

  Serial.println("commands: enrol <slot> <uuid> | forget <slot|255> | session | status");
}

// ----------------------------------------------------------------------- main
void setup() {
  Serial.begin(115200);
  delay(200);

  feedbackBegin();
  feedbackSet(FB_BOOT);

  pinMode(PIN_BUTTON, INPUT);  // external 10 kΩ pull-up; GPIO34 has none

  displayBegin();
#if TOUCH_CALIBRATION_MODE
  touchCalibrationLoop();  // never returns
#endif

  screenBoot("Starting...");
  loadState();

  camBegin();

  screenBoot("NFC...");
  if (!nfcBegin()) {
    // Not fatal: face check-in still works, so the terminal stays usable.
    Serial.println("PN532 not found — check SPI wiring and the board's DIP switches");
    screenBoot("NFC missing (continuing)");
    delay(1200);
  }

  screenBoot("Wi-Fi...");
  if (!wifiBegin(12000)) {
    Serial.println("Wi-Fi failed; will retry on first submit");
    screenBoot("Wi-Fi failed (will retry)");
    delay(1200);
  }

  enter(sessionValid() ? S_IDLE : S_ARM);
}

void loop() {
  feedbackTick();
  handleSerial();

  // ---- camera events
  CamEvent ev;
  if (camPoll(&ev)) {
    if (ev.type == CAM_EV_QR && g_state == S_ARM) {
      strncpy(g_qrToken, ev.text, sizeof(g_qrToken) - 1);
      g_qrToken[sizeof(g_qrToken) - 1] = '\0';
      g_qrArmedAt = millis();
      saveSession();
      showResult(true, "Session armed", g_qrToken);
    } else if (ev.type == CAM_EV_ENROLLED) {
      if (g_enrollSlot >= 0) {
        Serial.printf("slot %d enrolled\n", ev.slot);
        g_enrollSlot = -1;
        showResult(true, "Face enrolled", g_faces[ev.slot].trainee);
      }
    } else if (ev.type == CAM_EV_FACE && g_state == S_IDENTIFY) {
      if (ev.slot < 0 || ev.slot >= kMaxFaces) {
        showResult(false, "Not recognised", "No enrolled face matched");
      } else if (ev.confidence < FACE_MIN_CONFIDENCE) {
        showResult(false, "Not sure", "Move closer and try again");
      } else if (g_faces[ev.slot].trainee[0] == '\0') {
        showResult(false, "Unassigned face", "Slot has no trainee bound");
      } else {
        submitFor(g_faces[ev.slot].trainee);
      }
    } else if (ev.type == CAM_EV_ERR) {
      Serial.printf("cam error: %s\n", ev.text);
    }
  }

  // ---- button
  const int be = buttonEvent();
  if (be == 2) {
    enter(S_ARM);  // long press re-arms the session
  } else if (be == 1) {
    if (g_state == S_IDLE && sessionValid()) enter(S_IDENTIFY);
    else if (g_state == S_RESULT) enter(sessionValid() ? S_IDLE : S_ARM);
  }

  // ---- NFC (only while idle; the reader shares the bus with the display)
  if (g_state == S_IDLE) {
    NfcCard card;
    if (nfcPoll(&card)) {
      if (!sessionValid()) {
        showResult(false, "No session", "Long-press to arm a session first");
      } else if (card.trainee[0]) {
        submitFor(card.trainee);
      } else {
        // A blank card is a provisioning problem, not a trainee problem — say
        // which card, so it can be written.
        showResult(false, "Card not linked", card.uid);
      }
    }
  }

  // ---- timeouts
  const uint32_t held = millis() - g_stateSince;
  if (g_state == S_IDENTIFY && held > IDENTIFY_TIMEOUT_MS) {
    showResult(false, "Timed out", "No face detected");
  } else if (g_state == S_RESULT && held > RESULT_DWELL_MS) {
    enter(sessionValid() ? S_IDLE : S_ARM);
  } else if (g_state == S_IDLE && !sessionValid()) {
    enter(S_ARM);  // session expired underneath us
  }

  delay(5);
}
