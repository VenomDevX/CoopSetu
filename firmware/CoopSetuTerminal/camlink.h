// UART link to the ESP32-CAM.

#ifndef COOPSETU_CAMLINK_H
#define COOPSETU_CAMLINK_H

#include <Arduino.h>

enum CamMode { CAM_IDLE, CAM_QR, CAM_FACE };

enum CamEventType {
  CAM_EV_NONE,
  CAM_EV_READY,
  CAM_EV_QR,
  CAM_EV_FACE,      // slot >= 0 with confidence, or slot < 0 for "no match"
  CAM_EV_ENROLLED,
  CAM_EV_FRAME,     // preview thumbnail received
  CAM_EV_ERR,
};

struct CamEvent {
  CamEventType type;
  char text[288];  // QR payload or error message
  int slot;
  float confidence;
};

void camBegin();
void camSetMode(CamMode m);
void camEnroll(int slot);
void camForget(int slot);  // 255 wipes every enrolled face

// True once per decoded frame from the CAM.
bool camPoll(CamEvent *out);

// True if the CAM has answered at any point since boot.
bool camIsAlive();

// Preview control — enables/disables thumbnail streaming from the CAM.
void camPreviewOn();
void camPreviewOff();

// Returns true if a new preview frame is available since the last call.
// Copies the raw grayscale thumbnail into `buf` (must be at least w*h bytes).
bool camGetFrame(uint8_t *buf, uint16_t *w, uint16_t *h);

// True if there's a frame waiting to be consumed.
bool camHasFrame();

#endif  // COOPSETU_CAMLINK_H
