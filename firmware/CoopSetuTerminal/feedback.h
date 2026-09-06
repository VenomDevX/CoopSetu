// LEDs and buzzer. Non-blocking: patterns advance from feedbackTick().

#ifndef COOPSETU_FEEDBACK_H
#define COOPSETU_FEEDBACK_H

#include <Arduino.h>

enum FeedbackPattern {
  FB_NONE,
  FB_BOOT,     // short chirp, both LEDs
  FB_WAITING,  // slow green breathe
  FB_BUSY,     // fast green blink
  FB_SUCCESS,  // solid green + two rising beeps
  FB_FAILURE,  // solid red + one long low beep
  FB_ERROR,    // red blink, triple beep
};

void feedbackBegin();
void feedbackSet(FeedbackPattern p);
void feedbackTick();

#endif  // COOPSETU_FEEDBACK_H
