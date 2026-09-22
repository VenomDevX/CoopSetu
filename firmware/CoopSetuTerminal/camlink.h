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

// True only while the CAM has answered recently.
bool camIsAlive();

// Preview control. camPreviewOn() also asks for the first image.
void camPreviewOn();
void camPreviewOff();

// Ask the CAM for the next image. One request = one image, so the screen is
// never behind more than the frame it is drawing.
void camRequestFrame();

// Borrow the newest preview JPEG, or nullptr when none has arrived since the
// last call. The buffer stays valid until the next camPoll(), which is never
// called while a screen is drawing.
const uint8_t *camTakeJpeg(size_t *len);

// True if there's a frame waiting to be consumed.
bool camHasFrame();

// Link diagnostics for the UI.
struct CamLinkStats {
  uint32_t framesOk;      // preview frames decoded
  uint32_t badFrames;     // frames dropped by the protocol parser
  uint32_t lastRxMs;      // millis() of the last valid message, 0 = never
  char lastErr[64];       // last ERR:<message> from the CAM, "" = none
};
void camGetStats(CamLinkStats *out);

#endif  // COOPSETU_CAMLINK_H
