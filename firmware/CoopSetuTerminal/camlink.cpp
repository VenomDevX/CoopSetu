#include "camlink.h"
#include "config.h"
#include "protocol.h"

namespace {

HardwareSerial &Cam = Serial2;
ProtoReader g_reader;
bool g_alive = false;
uint32_t g_lastPing = 0;

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
