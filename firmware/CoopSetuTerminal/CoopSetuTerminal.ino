// CoopSetu attendance terminal — ESP32 38-pin devkit.
//
// Wiring is transcribed from Hardware.md into config.h; read the notes there
// before powering up, especially the two resistor values that are wrong in the
// parts list.
//
// Architecture (v2):
//   - Touch-navigable screen stack (screens.h/cpp) replaces the flat enum switch
//   - FreeRTOS network task (net_task.h/cpp) on core 0 handles WiFi/HTTP
//   - Main loop on core 1 handles display, touch, NFC, CAM-link
//   - Three attendance methods: RFID, QR, Face — all non-blocking
//   - Admin mode: PIN-gated on-device RFID registration
//
// Face matching happens entirely on the ESP32-CAM. The terminal never sees an
// embedding — it receives a slot number and maps it to a member via the backend.

#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <Adafruit_PN532.h>
#include <Preferences.h>

// arduino-esp32's default loopTask stack is 8 KB. That's tight once you add
// the FreeRTOS net-task queues, multiple ArduinoJson StaticJsonDocuments, and
// several ~400-byte NetRequest/NetResponse locals all living on this same
// task's stack (display/touch/NFC/CAM-link all run in loop() on core 1). The
// observed symptom was a hard "stack overflow in task loopTask" panic/reboot
// shortly after boot — not the display or PN532 wiring. Must be set before
// setup() runs; this macro is arduino-esp32's supported way to do that.
SET_LOOP_TASK_STACK_SIZE(16 * 1024);

#include "config.h"
#include "feedback.h"
#include "display.h"
#include "nfc.h"
#include "camlink.h"
#include "api.h"
#include "screens.h"
#include "net_task.h"

// Forward declaration for screensRegister() (defined in screens.cpp)
extern void screensRegister();

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

int g_enrollSlot = -1;  // >= 0 while an enrolment is in flight

// ---------------------------------------------------------------- persistence
void loadState() {
  g_prefs.begin("coopsetu", false);
  for (int i = 0; i < kMaxFaces; i++) {
    char key[8];
    snprintf(key, sizeof(key), "f%d", i);
    g_prefs.getString(key, g_faces[i].trainee, sizeof(g_faces[i].trainee));
  }
}

void saveFace(int slot) {
  char key[8];
  snprintf(key, sizeof(key), "f%d", slot);
  g_prefs.putString(key, g_faces[slot].trainee);
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
//   admin-pin <4digits>           set the admin PIN for on-device registration
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

  if (line.startsWith("admin-pin")) {
    const int sp = line.indexOf(' ');
    if (sp < 0 || line.length() - sp - 1 != 4) {
      Serial.println("usage: admin-pin <4digits>");
      return;
    }
    const String pin = line.substring(sp + 1);
    Preferences prefs;
    prefs.begin("coopsetu", false);
    prefs.putString("admin_pin", pin);
    prefs.end();
    Serial.printf("Admin PIN set to %s\n", pin.c_str());
    return;
  }

  if (line == "status") {
    Serial.printf("wifi=%d cam=%d screen=%d\n",
                  netWifiConnected(), camIsAlive(), (int)currentScreen());
    for (int i = 0; i < kMaxFaces; i++) {
      if (g_faces[i].trainee[0]) Serial.printf("  slot %d -> %s\n", i, g_faces[i].trainee);
    }
    return;
  }

  Serial.println("commands: enrol <slot> <uuid> | forget <slot|255> | admin-pin <4digits> | status");
}

// --------------------------------------------------------------- touch input
// Edge-detected, debounced touch polling.
namespace {
  uint32_t g_lastTouchMs = 0;
  bool     g_wasTouched  = false;
}

bool pollTouch(int16_t *x, int16_t *y) {
  // Enforce debounce window
  if (millis() - g_lastTouchMs < TOUCH_DEBOUNCE_MS) return false;

  int16_t tx, ty;
  bool touched = touchGet(&tx, &ty);

  // Edge detect: only fire on press (not hold)
  if (touched && !g_wasTouched) {
    g_wasTouched = true;
    g_lastTouchMs = millis();
    *x = tx;
    *y = ty;
    return true;
  }
  if (!touched) g_wasTouched = false;
  return false;
}

// ----------------------------------------------------------------------- main
void setup() {
  Serial.begin(115200);
  delay(1000);

  feedbackBegin();
  feedbackSet(FB_BOOT);

  pinMode(PIN_BUTTON, INPUT_PULLUP);  // internal pull-up enabled for GPIO33

  displayBegin();

  screenBoot("Starting...");
  loadState();

  // Initialize touch after SPI is stable
  touchInit();

#if TOUCH_CALIBRATION_MODE
  touchCalibrationLoop();  // never returns
#endif

  camBegin();

  screenBoot("NFC...");
  if (!nfcBegin()) {
    // Not fatal: face check-in still works, so the terminal stays usable.
    Serial.println("PN532 not found — check SPI wiring and the board's DIP switches");
    screenBoot("NFC missing (continuing)");
    delay(1200);
  }

  // Start network task on core 0 — handles WiFi + HTTP non-blocking
  screenBoot("Network...");
  delay(400);
  netTaskBegin();

  // Screen stack init
  screensBegin();
  screensRegister();

  // Let the user see the final boot state for a moment before jumping to UI
  screenBoot("Ready");
  delay(800);

  // Boot into Home screen
  pushScreen(SCR_HOME);
  feedbackSet(FB_WAITING);
}

void loop() {
  feedbackTick();
  handleSerial();

  // ---- touch events -> active screen
  int16_t tx, ty;
  if (pollTouch(&tx, &ty)) {
    Screen *s = activeScreen();
    if (s && s->onTouch) s->onTouch(tx, ty);
  }

  // ---- screen tick (drives NFC polling, network response handling, etc.)
  Screen *s = activeScreen();
  if (s && s->onTick) s->onTick();

  // ---- camera events that are not screen-specific (enrolment from serial)
  CamEvent ev;
  if (camPoll(&ev)) {
    if (ev.type == CAM_EV_ENROLLED && g_enrollSlot >= 0) {
      Serial.printf("slot %d enrolled\n", ev.slot);
      g_enrollSlot = -1;
      showResultScreen(true, "Face enrolled", g_faces[ev.slot].trainee);
    } else if (ev.type == CAM_EV_ERR) {
      Serial.printf("cam error: %s\n", ev.text);
    }
    // Screen-specific events (QR, FACE) are handled inside each screen's onTick
  }

  // ---- button: long press = go home, short press = back
  const int be = buttonEvent();
  if (be == 2) {
    // Long press: return to home
    while (currentScreen() != SCR_HOME) popScreen();
  } else if (be == 1) {
    // Short press: back
    popScreen();
  }

  delay(5);
}
