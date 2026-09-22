#include "camlink.h"
#include "config.h"
#include "protocol.h"

namespace {

HardwareSerial &Cam = Serial2;
ProtoReader g_reader;
bool g_alive = false;
uint32_t g_lastPing = 0;
uint32_t g_lastRecovery = 0;
CamMode g_mode = CAM_IDLE;

// Newest decoded preview JPEG.
static uint8_t g_jpg[PREVIEW_MAX_JPEG];
static size_t g_jpgLen = 0;
static bool g_frameReady = false;
static uint32_t g_framesOk = 0;
static uint32_t g_lastRxMs = 0;
static char g_lastErr[64] = {0};
static uint32_t g_badImages = 0;
static size_t g_imageExpected = 0;
static size_t g_imageReceived = 0;
static size_t g_imageDiscard = 0;
static uint32_t g_imageCrc = 0;

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
  // A preview frame is ~10 KB and arrives in ~110 ms at CAM_BAUD. The default
  // 256-byte RX buffer overflows whenever loop() is busy drawing, corrupting
  // nearly every frame. Must be set before begin().
  Cam.setRxBufferSize(16 * 1024);
  Cam.begin(CAM_BAUD, SERIAL_8N1, PIN_CAM_RX, PIN_CAM_TX);
  // The CAM's ROM bootloader prints on this line at every reset. Drop whatever
  // is already buffered; the checksum handles the rest.
  delay(50);
  while (Cam.available()) Cam.read();
}

void camSetMode(CamMode m) {
  g_mode = m;
  const char *name = m == CAM_QR ? "QR" : (m == CAM_FACE ? "FACE" : "IDLE");
  protoSendf(Cam, "%s:%s", CMD_MODE, name);
}

void camEnroll(int slot) { protoSendf(Cam, "%s:%d", CMD_ENROLL, slot); }
void camForget(int slot) { protoSendf(Cam, "%s:%d", CMD_FORGET, slot); }
bool camIsAlive() {
  return g_alive && g_lastRxMs && millis() - g_lastRxMs < 7500;
}

void camPreviewOn()  { protoSendf(Cam, "%s:ON",  CMD_PREVIEW); }
void camRequestFrame() { protoSend(Cam, CMD_SNAP); }
void camPreviewOff() { protoSendf(Cam, "%s:OFF", CMD_PREVIEW); }

bool camHasFrame() { return g_frameReady; }

const uint8_t *camTakeJpeg(size_t *len) {
  if (!g_frameReady) return nullptr;
  g_frameReady = false;
  *len = g_jpgLen;
  return g_jpg;
}

void camGetStats(CamLinkStats *out) {
  out->framesOk = g_framesOk;
  out->badFrames = g_reader.badFrames() + g_badImages;
  out->lastRxMs = g_lastRxMs;
  strncpy(out->lastErr, g_lastErr, sizeof(out->lastErr) - 1);
  out->lastErr[sizeof(out->lastErr) - 1] = '\0';
}

bool camPoll(CamEvent *out) {
  // Keep-alive so a CAM that browned out is noticed rather than silently absent.
  if (millis() - g_lastPing > 5000) {
    g_lastPing = millis();
    protoSend(Cam, CMD_PING);
  }

  // Recover the UART state after a camera brownout. This cannot power-cycle the
  // CAM, but it clears boot chatter and reapplies the requested mode once the
  // module returns.
  if (g_lastRxMs && millis() - g_lastRxMs > 15000 && millis() - g_lastRecovery > 15000) {
    g_lastRecovery = millis();
    g_alive = false;
    while (Cam.available()) Cam.read();
    Cam.end();
    Cam.begin(CAM_BAUD, SERIAL_8N1, PIN_CAM_RX, PIN_CAM_TX);
    camSetMode(g_mode);
  }

  // Consume at most 2 KB of a binary JPEG per UI tick. The previous readBytes
  // loop monopolised core 1 for up to 500 ms, freezing touch and animation.
  size_t budget = 2048;
  while (budget && Cam.available() && (g_imageExpected || g_imageDiscard)) {
    if (g_imageDiscard) {
      Cam.read();
      g_imageDiscard--;
    } else {
      g_jpg[g_imageReceived++] = (uint8_t)Cam.read();
      if (g_imageReceived == g_imageExpected) {
        if (protoCrc32(g_jpg, g_imageExpected) == g_imageCrc) {
          g_jpgLen = g_imageExpected;
          g_frameReady = true;
          g_framesOk++;
        } else {
          g_badImages++;
        }
        g_imageExpected = 0;
        g_imageReceived = 0;
      }
    }
    budget--;
  }
  if (g_imageExpected || g_imageDiscard) return false;

  // static, not a local: PROTO_MAX_BODY is 10 KB, and callers (qrTick,
  // faceTick) already hold several KB of their own. On loopTask's stack this
  // overflowed and rebooted the terminal the moment QR or Face ID opened.
  // camPoll() only ever runs on loopTask, so sharing the buffer is safe.
  static char body[PROTO_MAX_BODY];
  while (Cam.available()) {
    if (!g_reader.feed((char)Cam.read(), body, sizeof(body))) continue;

    g_alive = true;
    g_lastRxMs = millis();
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
    if (headIs(body, EVT_IMG) && rest) {
      // "<len>:<crc32 hex>" followed by len raw bytes.
      const size_t len = (size_t)strtoul(rest, nullptr, 10);
      const char *crcTxt = strchr(rest, ':');
      const uint32_t wantCrc = crcTxt ? (uint32_t)strtoul(crcTxt + 1, nullptr, 16) : 0;

      if (len == 0 || len > sizeof(g_jpg) || !crcTxt) {
        g_imageDiscard = len;
      } else {
        g_imageExpected = len;
        g_imageReceived = 0;
        g_imageCrc = wantCrc;
      }
      return false;  // binary payload is consumed incrementally on later ticks
    }
    if (headIs(body, EVT_ERR)) {
      out->type = CAM_EV_ERR;
      if (rest) {
        strncpy(out->text, rest, sizeof(out->text) - 1);
        out->text[sizeof(out->text) - 1] = '\0';
        strncpy(g_lastErr, rest, sizeof(g_lastErr) - 1);
      }
      return true;
    }
    // Unknown verb: ignore rather than surface, so adding events to the CAM
    // never breaks an older terminal build.
  }
  return false;
}
