#include "feedback.h"
#include "config.h"

namespace {

FeedbackPattern g_pattern = FB_NONE;
uint32_t g_start = 0;
int g_step = -1;

void buzzerOn() {
#if BUZZER_IS_PASSIVE
  ledcWriteTone(BUZZER_LEDC_CH, BUZZER_TONE_HZ);
#else
  digitalWrite(PIN_BUZZER, HIGH);
#endif
}

void buzzerOff() {
#if BUZZER_IS_PASSIVE
  ledcWriteTone(BUZZER_LEDC_CH, 0);
#else
  digitalWrite(PIN_BUZZER, LOW);
#endif
}

void leds(bool green, bool red) {
  digitalWrite(PIN_LED_GREEN, green ? HIGH : LOW);
  digitalWrite(PIN_LED_RED, red ? HIGH : LOW);
}

// Each pattern is a list of (duration, green, red, buzzer) steps. A duration of
// 0 marks the end; patterns either hold their last step or loop.
struct Step {
  uint16_t ms;
  bool green;
  bool red;
  bool buzz;
};

const Step kBoot[]    = {{80, 1, 1, 1}, {80, 0, 0, 0}, {0, 0, 0, 0}};
const Step kBusy[]    = {{120, 1, 0, 0}, {120, 0, 0, 0}, {0, 0, 0, 0}};
const Step kSuccess[] = {{90, 1, 0, 1}, {60, 1, 0, 0}, {140, 1, 0, 1}, {0, 1, 0, 0}};
const Step kFailure[] = {{450, 0, 1, 1}, {0, 0, 1, 0}};
const Step kError[]   = {{90, 0, 1, 1}, {90, 0, 0, 0}, {90, 0, 1, 1},
                         {90, 0, 0, 0}, {90, 0, 1, 1}, {0, 0, 1, 0}};

const Step *stepsFor(FeedbackPattern p, bool *loop) {
  *loop = false;
  switch (p) {
    case FB_BOOT:    return kBoot;
    case FB_BUSY:    *loop = true; return kBusy;
    case FB_SUCCESS: return kSuccess;
    case FB_FAILURE: return kFailure;
    case FB_ERROR:   return kError;
    default:         return nullptr;
  }
}

}  // namespace

void feedbackBegin() {
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
#if BUZZER_IS_PASSIVE
  ledcSetup(BUZZER_LEDC_CH, BUZZER_TONE_HZ, 10);
  ledcAttachPin(PIN_BUZZER, BUZZER_LEDC_CH);
#else
  pinMode(PIN_BUZZER, OUTPUT);
#endif
  leds(false, false);
  buzzerOff();
}

void feedbackSet(FeedbackPattern p) {
  if (p == g_pattern) return;
  g_pattern = p;
  g_step = -1;  // forces the first step to apply on the next tick
  g_start = 0;

  if (p == FB_NONE) {
    leds(false, false);
    buzzerOff();
  } else if (p == FB_WAITING) {
    // Steady dim-ish idle indicator: green on, nothing else. Kept as its own
    // case rather than a one-step table so it costs no timer work.
    leds(true, false);
    buzzerOff();
  }
}

void feedbackTick() {
  bool loop = false;
  const Step *steps = stepsFor(g_pattern, &loop);
  if (!steps) return;

  const uint32_t now = millis();

  if (g_step < 0) {
    g_step = 0;
    g_start = now;
    leds(steps[0].green, steps[0].red);
    steps[0].buzz ? buzzerOn() : buzzerOff();
    return;
  }

  const Step &cur = steps[g_step];
  if (cur.ms == 0) return;  // terminal step: hold forever

  if (now - g_start < cur.ms) return;

  g_step++;
  if (steps[g_step].ms == 0 && loop) g_step = 0;

  g_start = now;
  const Step &next = steps[g_step];
  leds(next.green, next.red);
  next.buzz ? buzzerOn() : buzzerOff();
}
