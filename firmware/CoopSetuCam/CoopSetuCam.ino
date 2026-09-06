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

#include <Arduino.h>
#include <esp_camera.h>
#include <EEPROM.h>

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
#include "quirc.h"

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
    if (slot == 255) g_recogniser->delete_all_id();
    else g_recogniser->delete_id(slot + 1, true);
    return;
  }

  if (is(CMD_LIST)) {
    protoSendf(Serial, "%s:%d", EVT_LIST, g_recogniser->get_enrolled_id_num());
    return;
  }
}

// ----------------------------------------------------------------------- main
void setup() {
  // Must match CAM_BAUD on the terminal. This is the link, not a console.
  Serial.begin(115200);

  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW);

  if (!psramFound()) {
    // Both paths depend on PSRAM: quirc needs a full-frame buffer and the
    // recogniser's model does not fit in internal RAM.
    reportErr("no PSRAM - QR and face are both unavailable");
  }

  g_recogniser = new FaceRecognition112V1S8();
  g_recogniser->set_partition(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "fr");
  g_recogniser->set_ids_from_flash();

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
}
