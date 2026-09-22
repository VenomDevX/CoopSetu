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
static const size_t PROTO_MAX_BODY = 10240;  // Must fit base64-encoded thumbnails (~9.2 KB)

// Link speed, shared so the two firmwares cannot drift apart. Preview images
// are ~10-15 KB each, so this is what caps the frame rate: 1 Mbit/s is ~8 fps.
// Both boards must be flashed together when this changes. If the terminal's
// Status page starts reporting bad frames, drop back to 460800.
static const unsigned long PROTO_BAUD = 1000000;

// Host -> CAM
#define CMD_PING     "PING"
#define CMD_MODE     "MODE"    // MODE:IDLE | MODE:QR | MODE:FACE
#define CMD_ENROLL   "ENROLL"  // ENROLL:<slot>
#define CMD_FORGET   "FORGET"  // FORGET:<slot>  (slot 255 = wipe all)
#define CMD_LIST     "LIST"
#define CMD_PREVIEW  "PREVIEW" // PREVIEW:ON | PREVIEW:OFF — enable/disable frame relay
// One image per request. Free-running streaming filled the terminal's RX
// buffer faster than it could decode, so the picture on screen ran further and
// further behind; asking for the next frame only when the last one is drawn
// keeps latency at one frame.
#define CMD_SNAP     "SNAP"

// CAM -> Host
#define EVT_READY    "READY"
#define EVT_PONG     "PONG"
#define EVT_QR       "QR"       // QR:<decoded text>
#define EVT_FACE     "FACE"     // FACE:<slot>:<confidence x100>  or FACE:NONE
#define EVT_ENROLLED "ENROLLED" // ENROLLED:<slot>
#define EVT_LIST     "LIST"     // LIST:<comma separated slots>
#define EVT_ERR      "ERR"      // ERR:<message>
#define EVT_FRAME    "FRAME"    // legacy base64 thumbnail, replaced by EVT_IMG

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
  // Not a local: a 10 KB array blows the CAM's 8 KB default loop stack as
  // soon as a preview frame is sent. Both firmwares only send from their
  // main loop task, so one shared buffer is safe.
  static char body[PROTO_MAX_BODY];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(body, sizeof(body), fmt, ap);
  va_end(ap);
  protoSend(out, body);
}


// ---------------------------------------------------------------- image frames
// Preview images are JPEG and binary: base64 in a text frame cost 33% more
// bytes and capped the preview at a 96x72 thumbnail. An image is announced by
// a normal text frame
//
//   #IMG:<len>:<crc32 hex>*<HH>\n
//
// immediately followed by exactly <len> raw bytes. CRC32 (not the XOR used for
// text) is what makes a damaged image detectable.
#define EVT_IMG      "IMG"

inline uint32_t protoCrc32(const uint8_t *data, size_t len) {
  uint32_t crc = 0xFFFFFFFFu;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int b = 0; b < 8; b++) crc = (crc >> 1) ^ (0xEDB88320u & (-(int32_t)(crc & 1)));
  }
  return ~crc;
}

// Header frame + raw payload. The payload is written in one go; UART flow is
// handled by the driver's TX buffer.
inline void protoSendImage(Stream &out, const uint8_t *data, size_t len) {
  char head[48];
  snprintf(head, sizeof(head), "%s:%u:%08X", EVT_IMG, (unsigned)len,
           (unsigned)protoCrc32(data, len));
  protoSend(out, head);
  out.write(data, len);
  out.flush();
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
      if (!ok) bad_++;
      inFrame_ = false;
      len_ = 0;
      return ok;
    }
    if (len_ + 1 >= sizeof(buf_)) {  // overlong: drop and wait for next '#'
      inFrame_ = false;
      len_ = 0;
      bad_++;
      return false;
    }
    buf_[len_++] = c;
    return false;
  }

  // Frames dropped for a bad checksum, bad trailer or overflow. Rising
  // steadily means the link itself is corrupting data (baud, wiring, GND).
  uint32_t badFrames() const { return bad_; }

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
  uint32_t bad_ = 0;
};

#endif  // COOPSETU_PROTOCOL_H
