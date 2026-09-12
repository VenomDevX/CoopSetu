#include "camlink.h"
#include "config.h"
#include "protocol.h"

namespace {

HardwareSerial &Cam = Serial2;
ProtoReader g_reader;
bool g_alive = false;
uint32_t g_lastPing = 0;

// Preview frame buffer
static uint8_t g_frameBuf[PREVIEW_WIDTH * PREVIEW_HEIGHT];
static uint16_t g_frameW = 0, g_frameH = 0;
static bool g_frameReady = false;

// Minimal base64 decode for frame data from the CAM
static const int8_t kB64[256] = {
  -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
  52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
  -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
  15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
  -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
  41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
};

static size_t b64Decode(const char *src, size_t srcLen, uint8_t *dst, size_t dstSize) {
  size_t j = 0;
  uint32_t acc = 0;
  int bits = 0;
  for (size_t i = 0; i < srcLen && j < dstSize; i++) {
    int8_t v = (uint8_t)src[i] < 128 ? kB64[(uint8_t)src[i]] : -1;
    if (v < 0) continue;  // skip padding and whitespace
    acc = (acc << 6) | (uint32_t)v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      dst[j++] = (uint8_t)(acc >> bits);
    }
  }
  return j;
}

// Splits "HEAD:rest" — returns the head length, or the whole length if no colon.
size_t headLen(const char *s) {
  const char *c = strchr(s, ':');
  return c ? (size_t)(c - s) : strlen(s);
}

bool headIs(const char *body, const char *want) {
  const size_t n = headLen(body);
  return strlen(want) == n && strncmp(body, want, n) == 0;
}

}  // namespace

void camBegin() {
  Cam.begin(CAM_BAUD, SERIAL_8N1, PIN_CAM_RX, PIN_CAM_TX);
  // The CAM's ROM bootloader prints on this line at every reset. Drop whatever
  // is already buffered; the checksum handles the rest.
  delay(50);
  while (Cam.available()) Cam.read();
}

void camSetMode(CamMode m) {
  const char *name = m == CAM_QR ? "QR" : (m == CAM_FACE ? "FACE" : "IDLE");
  protoSendf(Cam, "%s:%s", CMD_MODE, name);
}

void camEnroll(int slot) { protoSendf(Cam, "%s:%d", CMD_ENROLL, slot); }
void camForget(int slot) { protoSendf(Cam, "%s:%d", CMD_FORGET, slot); }
bool camIsAlive() { return g_alive; }

void camPreviewOn()  { protoSendf(Cam, "%s:ON",  CMD_PREVIEW); }
void camPreviewOff() { protoSendf(Cam, "%s:OFF", CMD_PREVIEW); }

bool camHasFrame() { return g_frameReady; }

bool camGetFrame(uint8_t *buf, uint16_t *w, uint16_t *h) {
  if (!g_frameReady) return false;
  *w = g_frameW;
  *h = g_frameH;
  memcpy(buf, g_frameBuf, (size_t)g_frameW * g_frameH);
  g_frameReady = false;
  return true;
}

bool camPoll(CamEvent *out) {
  // Keep-alive so a CAM that browned out is noticed rather than silently absent.
  if (millis() - g_lastPing > 5000) {
    g_lastPing = millis();
    protoSend(Cam, CMD_PING);
  }

  char body[PROTO_MAX_BODY];
  while (Cam.available()) {
    if (!g_reader.feed((char)Cam.read(), body, sizeof(body))) continue;

    g_alive = true;
    out->type = CAM_EV_NONE;
    out->slot = -1;
    out->confidence = 0.0f;
    out->text[0] = '\0';

    const char *rest = strchr(body, ':');
    if (rest) rest++;

    if (headIs(body, EVT_PONG)) {
      continue;  // liveness only
    }
    if (headIs(body, EVT_READY)) {
      out->type = CAM_EV_READY;
      return true;
    }
    if (headIs(body, EVT_QR) && rest) {
      out->type = CAM_EV_QR;
      strncpy(out->text, rest, sizeof(out->text) - 1);
      out->text[sizeof(out->text) - 1] = '\0';
      return true;
    }
    if (headIs(body, EVT_FACE) && rest) {
      out->type = CAM_EV_FACE;
      if (strncmp(rest, "NONE", 4) == 0) {
        out->slot = -1;
      } else {
        // "<slot>:<confidence x100>"
        out->slot = atoi(rest);
        const char *c2 = strchr(rest, ':');
        out->confidence = c2 ? atoi(c2 + 1) / 100.0f : 0.0f;
      }
      return true;
    }
    if (headIs(body, EVT_ENROLLED) && rest) {
      out->type = CAM_EV_ENROLLED;
      out->slot = atoi(rest);
      return true;
    }
    if (headIs(body, EVT_FRAME) && rest) {
      // Base64-encoded grayscale thumbnail from the CAM
      const size_t restLen = strlen(rest);
      const size_t decoded = b64Decode(rest, restLen, g_frameBuf, sizeof(g_frameBuf));
      if (decoded == PREVIEW_WIDTH * PREVIEW_HEIGHT) {
        g_frameW = PREVIEW_WIDTH;
        g_frameH = PREVIEW_HEIGHT;
        g_frameReady = true;
      }
      // Frame events are consumed silently by the preview screen;
      // don't propagate them as CamEvents to the main loop.
      continue;
    }
    if (headIs(body, EVT_ERR)) {
      out->type = CAM_EV_ERR;
      if (rest) {
        strncpy(out->text, rest, sizeof(out->text) - 1);
        out->text[sizeof(out->text) - 1] = '\0';
      }
      return true;
    }
    // Unknown verb: ignore rather than surface, so adding events to the CAM
    // never breaks an older terminal build.
  }
  return false;
}
