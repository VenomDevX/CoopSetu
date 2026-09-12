// CoopSetu vision module — AI-Thinker ESP32-CAM.
//
// Slave to the terminal over UART. Two jobs, never at once:
//   MODE:QR    decode QR codes (quirc, GRAYSCALE frames)
//   MODE:FACE  detect + recognise a face (ESP-DL, RGB565 frames)
//
// Why the modes are exclusive: quirc wants an 8-bit grayscale buffer and
// ESP-DL's recogniser wants RGB565, and esp32-camera fixes the pixel format at
// init. Switching therefore deinitialises and reinitialises the driver
// (~200 ms). Converting one format to the other every frame would cost more
// RAM than the CAM has spare once the recognition model is resident.
//
// IMPORTANT — this sketch must be built against arduino-esp32 **2.0.x**.
// The bundled ESP-DL face models (face_recognition_112_v1_s8) were removed in
// core 3.x, so FACE mode will not compile there. See firmware/README.md.
//
// Serial (UART0, GPIO1/GPIO3) is the link to the terminal, NOT a debug console.
// Anything printed with Serial.print would be parsed as protocol noise, so all
// diagnostics go out as ERR frames instead.
//
// To enable boot-time debug prints (which pollute the protocol UART), uncomment:
// #define CAM_DEBUG

#include <Arduino.h>
#include <esp_camera.h>
#include <EEPROM.h>

#include <ESP32QRCodeReader.h>

#include "camera_pins.h"
#include "protocol.h"

// ESP-DL: face detection + recognition. Bundled with arduino-esp32 2.0.x.
#include "human_face_detect_msr01.hpp"
#include "human_face_detect_mnp01.hpp"
#include "face_recognition_tool.hpp"
#include "face_recognition_112_v1_s8.hpp"

#define FACE_ID_MAX      16
#define ENROL_SAMPLES     4     // frames averaged into one enrolled identity
#define QR_COOLDOWN_MS  1500    // don't re-report the same code instantly

enum Mode { MODE_IDLE, MODE_QR, MODE_FACE };

static Mode g_mode = MODE_IDLE;
static Mode g_wantMode = MODE_IDLE;
static bool g_camReady = false;
static pixformat_t g_camFormat = PIXFORMAT_GRAYSCALE;
static bool g_previewEnabled = false;  // PREVIEW:ON/OFF toggle

static ProtoReader g_reader;

static HumanFaceDetectMSR01 g_detector(0.3F, 0.3F, 10, 0.3F);
static HumanFaceDetectMNP01 g_detector2(0.4F, 0.3F, 10);
static FaceRecognition112V1S8 *g_recogniser = nullptr;

static int g_enrolTarget = -1;   // slot being enrolled, or -1
static int g_enrolCount = 0;

static char g_lastQr[PROTO_MAX_BODY] = {0};
static uint32_t g_lastQrAt = 0;

// ------------------------------------------------------------------ reporting
static void reportErr(const char *fmt, ...) {
  char msg[192];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(msg, sizeof(msg), fmt, ap);
  va_end(ap);
  protoSendf(Serial, "%s:%s", EVT_ERR, msg);
}

// -------------------------------------------------------------------- camera
static bool cameraStart(pixformat_t fmt) {
  if (g_camReady) {
    esp_camera_deinit();
    g_camReady = false;
    delay(50);
  }

  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer   = LEDC_TIMER_0;
  c.pin_d0 = Y2_GPIO_NUM;   c.pin_d1 = Y3_GPIO_NUM;
  c.pin_d2 = Y4_GPIO_NUM;   c.pin_d3 = Y5_GPIO_NUM;
  c.pin_d4 = Y6_GPIO_NUM;   c.pin_d5 = Y7_GPIO_NUM;
  c.pin_d6 = Y8_GPIO_NUM;   c.pin_d7 = Y9_GPIO_NUM;
  c.pin_xclk = XCLK_GPIO_NUM;
  c.pin_pclk = PCLK_GPIO_NUM;
  c.pin_vsync = VSYNC_GPIO_NUM;
  c.pin_href = HREF_GPIO_NUM;
  c.pin_sscb_sda = SIOD_GPIO_NUM;
  c.pin_sscb_scl = SIOC_GPIO_NUM;
  c.pin_pwdn = PWDN_GPIO_NUM;
  c.pin_reset = RESET_GPIO_NUM;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = fmt;
  c.fb_location = CAMERA_FB_IN_PSRAM;
  c.grab_mode = CAMERA_GRAB_LATEST;  // always work on the freshest frame

  if (fmt == PIXFORMAT_GRAYSCALE) {
    // QR: more pixels means more decodable distance, and grayscale frames are
    // cheap, so VGA is affordable here.
    c.frame_size = FRAMESIZE_VGA;   // 640x480
    c.fb_count = 1;
  } else {
    // Face: the recogniser resizes to 112x112 anyway; QVGA keeps two RGB565
    // buffers plus the model inside PSRAM.
    c.frame_size = FRAMESIZE_QVGA;  // 320x240
    c.fb_count = 2;
  }

  const esp_err_t err = esp_camera_init(&c);
  if (err != ESP_OK) {
    reportErr("camera init 0x%x", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    // The OV2640 ships mirrored/upside-down on most AI-Thinker boards.
    s->set_vflip(s, 1);
    s->set_hmirror(s, 0);
    s->set_brightness(s, 1);
    s->set_saturation(s, 0);
  }

  g_camFormat = fmt;
  g_camReady = true;
  return true;
}

static bool ensureMode(Mode m) {
  if (m == g_mode && (m == MODE_IDLE || g_camReady)) return true;

  if (m == MODE_IDLE) {
    if (g_camReady) {
      esp_camera_deinit();
      g_camReady = false;
    }
    g_mode = MODE_IDLE;
    return true;
  }

  const pixformat_t want = (m == MODE_QR) ? PIXFORMAT_GRAYSCALE : PIXFORMAT_RGB565;
  if (!cameraStart(want)) {
    g_mode = MODE_IDLE;
    return false;
  }
  g_mode = m;
  return true;
}

// ------------------------------------------------------------------------ QR
// quirc ships inside the ESP32QRCodeReader library (src/quirc.h). We drive it
// directly rather than using that library's own task+camera wrapper, because
// this sketch has to own the camera lifecycle to share it with FACE mode.
#include "quirc/quirc.h"

static struct quirc *g_qr = nullptr;

static bool qrStart(int w, int h) {
  if (g_qr) {
    quirc_destroy(g_qr);
    g_qr = nullptr;
  }
  g_qr = quirc_new();
  if (!g_qr) return false;
  if (quirc_resize(g_qr, w, h) < 0) {  // allocates w*h bytes in PSRAM
    quirc_destroy(g_qr);
    g_qr = nullptr;
    return false;
  }
  return true;
}

static void qrTick() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) return;

  if (!g_qr && !qrStart(fb->width, fb->height)) {
    esp_camera_fb_return(fb);
    reportErr("quirc alloc failed");
    return;
  }

  int w = 0, h = 0;
  uint8_t *image = quirc_begin(g_qr, &w, &h);
  if ((int)fb->width == w && (int)fb->height == h) {
    memcpy(image, fb->buf, (size_t)w * h);  // GRAYSCALE == 1 byte per pixel
  }
  quirc_end(g_qr);
  esp_camera_fb_return(fb);

  const int count = quirc_count(g_qr);
  for (int i = 0; i < count; i++) {
    struct quirc_code code;
    struct quirc_data data;
    quirc_extract(g_qr, i, &code);
    if (quirc_decode(&code, &data) != QUIRC_SUCCESS) continue;

    char text[PROTO_MAX_BODY];
    const size_t n = min((size_t)data.payload_len, sizeof(text) - 1);
    memcpy(text, data.payload, n);
    text[n] = '\0';

    // The terminal is pointed at a screen showing one code; without a cooldown
    // it would re-arm on every frame.
    if (strcmp(text, g_lastQr) == 0 && millis() - g_lastQrAt < QR_COOLDOWN_MS) continue;
    strncpy(g_lastQr, text, sizeof(g_lastQr) - 1);
    g_lastQr[sizeof(g_lastQr) - 1] = '\0';
    g_lastQrAt = millis();

    protoSendf(Serial, "%s:%s", EVT_QR, text);
    return;
  }
}

// ---------------------------------------------------------------------- faces
// Enrolled identities live in the recogniser's own flash-backed store. The
// terminal owns the slot -> trainee mapping; this side only knows slot numbers.
static void faceTick() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) return;

  std::vector<int> shape = {(int)fb->height, (int)fb->width, 3};
  std::list<dl::detect::result_t> candidates =
      g_detector.infer((uint16_t *)fb->buf, shape);
  std::list<dl::detect::result_t> faces =
      g_detector2.infer((uint16_t *)fb->buf, shape, candidates);

  if (faces.empty()) {
    esp_camera_fb_return(fb);
    return;
  }

  if (g_enrolTarget >= 0) {
    const int id = g_recogniser->enroll_id((uint16_t *)fb->buf, shape,
                                           faces.front().keypoint, "", true);
    esp_camera_fb_return(fb);

    if (id < 0) {
      reportErr("enrol failed");
      g_enrolTarget = -1;
      g_enrolCount = 0;
      return;
    }
    if (++g_enrolCount >= ENROL_SAMPLES) {
      protoSendf(Serial, "%s:%d", EVT_ENROLLED, g_enrolTarget);
      g_enrolTarget = -1;
      g_enrolCount = 0;
      ensureMode(MODE_IDLE);
    }
    return;
  }

  face_info_t r = g_recogniser->recognize((uint16_t *)fb->buf, shape,
                                          faces.front().keypoint);
  esp_camera_fb_return(fb);

  if (r.id > 0) {
    protoSendf(Serial, "%s:%d:%d", EVT_FACE, r.id - 1, (int)(r.similarity * 100));
  } else {
    protoSendf(Serial, "%s:NONE", EVT_FACE);
  }
  ensureMode(MODE_IDLE);  // one answer per request; the terminal re-arms
}

// ------------------------------------------------------------------- preview
// Thumbnail relay for the terminal's TFT. Downsamples the current camera
// frame (whatever mode) to PREVIEW_W x PREVIEW_H grayscale, base64-encodes
// it, and sends it as an EVT_FRAME.

#define PREVIEW_W 96
#define PREVIEW_H 72

static const char kB64Chars[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Encodes `len` bytes from `src` into base64 at `dst` (must be ≥ 4*ceil(len/3)+1).
// Returns the number of characters written (excluding NUL).
static size_t b64Encode(const uint8_t *src, size_t len, char *dst, size_t dstSize) {
  size_t o = 0;
  size_t i = 0;
  while (i < len && o + 4 < dstSize) {
    uint32_t a = src[i++];
    uint32_t b = (i < len) ? src[i++] : 0;
    uint32_t c = (i < len) ? src[i++] : 0;
    uint32_t triple = (a << 16) | (b << 8) | c;

    dst[o++] = kB64Chars[(triple >> 18) & 0x3F];
    dst[o++] = kB64Chars[(triple >> 12) & 0x3F];
    dst[o++] = (i > len + 1) ? '=' : kB64Chars[(triple >> 6) & 0x3F];
    dst[o++] = (i > len)     ? '=' : kB64Chars[triple & 0x3F];
  }
  dst[o] = '\0';
  return o;
}

// Throttle: don't send preview frames faster than ~8 fps to avoid saturating
// the UART (96*72 = 6912 bytes → ~9216 bytes base64 → ~10 KB framed → ~87 ms
// at 921600 baud). A 130 ms interval gives ~7.7 fps with headroom.
static uint32_t g_lastPreviewMs = 0;
static const uint32_t kPreviewIntervalMs = 130;

static void previewTick() {
  if (!g_previewEnabled || !g_camReady) return;
  if (millis() - g_lastPreviewMs < kPreviewIntervalMs) return;
  g_lastPreviewMs = millis();

  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) return;

  // Downsample to PREVIEW_W x PREVIEW_H grayscale.
  // The source is either GRAYSCALE (QR mode) or RGB565 (FACE mode).
  static uint8_t thumb[PREVIEW_W * PREVIEW_H];

  const int srcW = fb->width;
  const int srcH = fb->height;

  for (int ty = 0; ty < PREVIEW_H; ty++) {
    const int sy = ty * srcH / PREVIEW_H;
    for (int tx = 0; tx < PREVIEW_W; tx++) {
      const int sx = tx * srcW / PREVIEW_W;

      if (g_camFormat == PIXFORMAT_GRAYSCALE) {
        thumb[ty * PREVIEW_W + tx] = fb->buf[sy * srcW + sx];
      } else {
        // RGB565 → grayscale. Pixel at (sx, sy).
        const uint16_t px = ((uint16_t *)fb->buf)[sy * srcW + sx];
        const uint8_t r5 = (px >> 11) & 0x1F;
        const uint8_t g6 = (px >> 5) & 0x3F;
        const uint8_t b5 = px & 0x1F;
        // Approximate Y = 0.299R + 0.587G + 0.114B with integer math:
        // (r5*8*77 + g6*4*150 + b5*8*29) >> 8
        thumb[ty * PREVIEW_W + tx] = (uint8_t)(
          ((uint32_t)(r5 << 3) * 77 + (uint32_t)(g6 << 2) * 150 + (uint32_t)(b5 << 3) * 29) >> 8
        );
      }
    }
  }

  esp_camera_fb_return(fb);

  // Base64-encode the thumbnail.
  // 6912 raw bytes → 9216 base64 chars + NUL.
  static char b64Buf[9220];
  const size_t b64Len = b64Encode(thumb, PREVIEW_W * PREVIEW_H, b64Buf, sizeof(b64Buf));
  (void)b64Len;

  // Send as EVT_FRAME:base64...
  protoSendf(Serial, "%s:%s", EVT_FRAME, b64Buf);
}

// -------------------------------------------------------------------- command
static void handleFrame(const char *body) {
  const char *rest = strchr(body, ':');
  if (rest) rest++;
  const size_t head = rest ? (size_t)(rest - body - 1) : strlen(body);

  auto is = [&](const char *w) {
    return strlen(w) == head && strncmp(body, w, head) == 0;
  };

  if (is(CMD_PING)) {
    protoSend(Serial, EVT_PONG);
    return;
  }

  if (is(CMD_MODE) && rest) {
    if (strcmp(rest, "QR") == 0) g_wantMode = MODE_QR;
    else if (strcmp(rest, "FACE") == 0) g_wantMode = MODE_FACE;
    else g_wantMode = MODE_IDLE;
    return;
  }

  if (is(CMD_ENROLL) && rest) {
    const int slot = atoi(rest);
    if (slot < 0 || slot >= FACE_ID_MAX) {
      reportErr("slot out of range");
      return;
    }
    g_enrolTarget = slot;
    g_enrolCount = 0;
    g_wantMode = MODE_FACE;
    return;
  }

  if (is(CMD_FORGET) && rest) {
    const int slot = atoi(rest);
    if (slot == 255) g_recogniser->delete_id(true);
    else g_recogniser->delete_id(slot + 1, true);
    return;
  }

  if (is(CMD_LIST)) {
    protoSendf(Serial, "%s:%d", EVT_LIST, g_recogniser->get_enrolled_id_num());
    return;
  }

  if (is(CMD_PREVIEW) && rest) {
    g_previewEnabled = (strcmp(rest, "ON") == 0);
    return;
  }
}

// ----------------------------------------------------------------------- main
void setup() {
  // Must match CAM_BAUD on the terminal. This is the link, not a console.
  Serial.begin(921600);
  
  // Give the serial port a moment to connect
  delay(1000);
#ifdef CAM_DEBUG
  Serial.println("\n\n--- ESP32-CAM STARTING ---");
#endif

  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW);

  if (!psramFound()) {
    // Both paths depend on PSRAM: quirc needs a full-frame buffer and the
    // recogniser's model does not fit in internal RAM.
#ifdef CAM_DEBUG
    Serial.println("CRITICAL ERROR: PSRAM not found! Please enable PSRAM in Tools > PSRAM > Enabled.");
#endif
    reportErr("no PSRAM - QR and face are both unavailable");
    while (true) { delay(100); } // Halt here to prevent ESP-DL from crashing
  }

#ifdef CAM_DEBUG
  Serial.println("PSRAM found. Loading ESP-DL face recognition models...");
#endif

  g_recogniser = new FaceRecognition112V1S8();
  g_recogniser->set_partition(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "fr");
  g_recogniser->set_ids_from_flash();

#ifdef CAM_DEBUG
  Serial.println("Models loaded. Sending READY to terminal.");
#endif
  protoSend(Serial, EVT_READY);
}

void loop() {
  char body[PROTO_MAX_BODY];
  while (Serial.available()) {
    if (g_reader.feed((char)Serial.read(), body, sizeof(body))) handleFrame(body);
  }

  if (g_wantMode != g_mode) ensureMode(g_wantMode);

  if (g_mode == MODE_QR) qrTick();
  else if (g_mode == MODE_FACE) faceTick();
  else delay(10);

  // Preview thumbnails are sent alongside the active mode's work.
  // This runs after the mode tick so QR/face processing gets priority.
  previewTick();
}
