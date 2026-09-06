// Framing for the ESP32 <-> ESP32-CAM UART link.
//
// This file is IDENTICAL in CoopSetuTerminal/ and CoopSetuCam/. Arduino IDE
// compiles one sketch folder at a time and will not look outside it, so the
// duplication is deliberate. Edit both copies together.
//
// Why a framed protocol instead of plain println():
// the CAM's TX is GPIO1 (U0TXD), the same pin the ROM bootloader logs on. Every
// CAM reset dumps boot chatter into the terminal's RX at whatever baud the ROM
// picked. Bare lines would be indistinguishable from real messages, so every
// frame carries a start marker and an XOR checksum and anything that fails to
// parse is dropped silently.
//
//   #<body>*<HH>\n      HH = two uppercase hex digits, XOR of every byte in body
//
// Example:  #QR:abc123*5E\n

#ifndef COOPSETU_PROTOCOL_H
#define COOPSETU_PROTOCOL_H

#include <Arduino.h>

static const char PROTO_START = '#';
static const char PROTO_CHECK = '*';
static const size_t PROTO_MAX_BODY = 512;  // QR payloads dominate this

// Host -> CAM
#define CMD_PING     "PING"
#define CMD_MODE     "MODE"    // MODE:IDLE | MODE:QR | MODE:FACE
#define CMD_ENROLL   "ENROLL"  // ENROLL:<slot>
#define CMD_FORGET   "FORGET"  // FORGET:<slot>  (slot 255 = wipe all)
#define CMD_LIST     "LIST"

// CAM -> Host
#define EVT_READY    "READY"
#define EVT_PONG     "PONG"
#define EVT_QR       "QR"       // QR:<decoded text>
#define EVT_FACE     "FACE"     // FACE:<slot>:<confidence x100>  or FACE:NONE
#define EVT_ENROLLED "ENROLLED" // ENROLLED:<slot>
#define EVT_LIST     "LIST"     // LIST:<comma separated slots>
#define EVT_ERR      "ERR"      // ERR:<message>

inline uint8_t protoChecksum(const char *body, size_t len) {
  uint8_t c = 0;
  for (size_t i = 0; i < len; i++) c ^= (uint8_t)body[i];
  return c;
}

// Writes "#<body>*<HH>\n" to `out`.
inline void protoSend(Stream &out, const char *body) {
  const size_t len = strlen(body);
  char sum[4];
  snprintf(sum, sizeof(sum), "%02X", protoChecksum(body, len));
  out.write(PROTO_START);
  out.write((const uint8_t *)body, len);
  out.write(PROTO_CHECK);
  out.write((const uint8_t *)sum, 2);
  out.write('\n');
  out.flush();
}

inline void protoSendf(Stream &out, const char *fmt, ...) {
  char body[PROTO_MAX_BODY];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(body, sizeof(body), fmt, ap);
  va_end(ap);
  protoSend(out, body);
}

// Incremental parser. Feed it every byte that arrives; it returns true exactly
// once per valid frame, with the body (checksum stripped) in `bodyOut`.
//
// Deliberately tolerant: a stray PROTO_START restarts the frame rather than
// aborting, so a truncated frame followed by a good one still yields the good
// one. That matters because boot noise is arbitrary binary.
class ProtoReader {
 public:
  bool feed(char c, char *bodyOut, size_t bodyOutSize) {
    if (c == PROTO_START) {  // (re)start, even mid-frame
      len_ = 0;
      inFrame_ = true;
      return false;
    }
    if (!inFrame_) return false;

    if (c == '\n' || c == '\r') {
      const bool ok = finish(bodyOut, bodyOutSize);
      inFrame_ = false;
      len_ = 0;
      return ok;
    }
    if (len_ + 1 >= sizeof(buf_)) {  // overlong: drop and wait for next '#'
      inFrame_ = false;
      len_ = 0;
      return false;
    }
    buf_[len_++] = c;
    return false;
  }

 private:
  bool finish(char *bodyOut, size_t bodyOutSize) {
    // Need at least "X*HH"
    if (len_ < 4) return false;
    if (buf_[len_ - 3] != PROTO_CHECK) return false;

    const size_t bodyLen = len_ - 3;
    char hex[3] = {buf_[len_ - 2], buf_[len_ - 1], 0};
    char *end = nullptr;
    const long want = strtol(hex, &end, 16);
    if (end != hex + 2) return false;
    if ((uint8_t)want != protoChecksum(buf_, bodyLen)) return false;
    if (bodyLen + 1 > bodyOutSize) return false;

    memcpy(bodyOut, buf_, bodyLen);
    bodyOut[bodyLen] = '\0';
    return true;
  }

  char buf_[PROTO_MAX_BODY + 8];
  size_t len_ = 0;
  bool inFrame_ = false;
};

#endif  // COOPSETU_PROTOCOL_H
