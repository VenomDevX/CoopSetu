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
#include <esp_heap_caps.h>
#include <img_converters.h>
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
static pixformat_t g_camFormat = PIXFORMAT_JPEG;
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
  c.jpeg_quality = 12;               // OV2640 scale: lower is better

  // QR uses the OV2640's native JPEG output. This avoids capturing a 150 KB
  // RGB frame and software-compressing it before every preview. FACE keeps
  // RGB565 because the ESP-DL model consumes that format directly.
  c.frame_size = FRAMESIZE_QVGA;  // 320x240
  // Continuous double-buffering is supported for JPEG and substantially
  // improves preview latency. RGB565 stays single-buffered for ESP-DL.
  c.fb_count = (fmt == PIXFORMAT_JPEG) ? 2 : 1;

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

    // Defaults render washed out and soft on this sensor. Auto exposure,
    // gain and white balance keep indoor light usable; saturation and
    // contrast put the colour back; lens correction fixes the dim corners
    // the wide-angle lens leaves.
    s->set_brightness(s, 0);
    s->set_contrast(s, 1);
    s->set_saturation(s, 2);
    if (s->set_sharpness) s->set_sharpness(s, 2);
    if (s->set_denoise) s->set_denoise(s, 0);
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_aec2(s, 1);
    s->set_gain_ctrl(s, 1);
    s->set_lenc(s, 1);
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

  const pixformat_t want = (m == MODE_QR) ? PIXFORMAT_JPEG : PIXFORMAT_RGB565;
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
static uint8_t *g_qrRgb = nullptr;
static size_t g_qrRgbSize = 0;

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

// Takes a borrowed JPEG/RGB565 frame; the caller owns fb and returns it.
// Returns true when a QR event was sent, allowing the loop to skip an obsolete
// preview frame and let the terminal advance immediately.
static bool qrProcess(camera_fb_t *fb) {
  if (!g_qr && !qrStart(fb->width, fb->height)) {
    reportErr("quirc alloc failed");
    return false;
  }

  int w = 0, h = 0;
  uint8_t *image = quirc_begin(g_qr, &w, &h);
  if ((int)fb->width == w && (int)fb->height == h) {
    const size_t n = (size_t)w * h;
    if (fb->format == PIXFORMAT_JPEG) {
      const size_t need = n * 3;
      if (g_qrRgbSize < need) {
        free(g_qrRgb);
        g_qrRgb = (uint8_t *)heap_caps_malloc(
            need, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        g_qrRgbSize = g_qrRgb ? need : 0;
      }
      if (!g_qrRgb || !fmt2rgb888(fb->buf, fb->len, fb->format, g_qrRgb)) {
        quirc_end(g_qr);
        reportErr("jpeg decode failed");
        return false;
      }
      // esp32-camera's RGB888 conversion is B, G, R byte order.
      for (size_t i = 0; i < n; i++) {
        const uint8_t b = g_qrRgb[i * 3], g = g_qrRgb[i * 3 + 1], r = g_qrRgb[i * 3 + 2];
        image[i] = (uint8_t)(((uint32_t)r * 77 + (uint32_t)g * 150 +
                              (uint32_t)b * 29) >> 8);
      }
    } else {
      // Camera RGB565 is big-endian. Reading it as uint16_t on ESP32 swaps
      // the bytes and was the reason QR contrast detection was unreliable.
      for (size_t i = 0; i < n; i++) {
        const uint8_t hi = fb->buf[i * 2], lo = fb->buf[i * 2 + 1];
        const uint8_t r = hi & 0xF8;
        const uint8_t g = (uint8_t)(((hi & 0x07) << 5) | ((lo & 0xE0) >> 3));
        const uint8_t b = (lo & 0x1F) << 3;
        image[i] = (uint8_t)(((uint32_t)r * 77 + (uint32_t)g * 150 +
                              (uint32_t)b * 29) >> 8);
      }
    }
  }
  quirc_end(g_qr);

  const int count = quirc_count(g_qr);
  for (int i = 0; i < count; i++) {
    struct quirc_code code;
    struct quirc_data data;
    quirc_extract(g_qr, i, &code);
    if (quirc_decode(&code, &data) != QUIRC_SUCCESS) continue;

    static char text[PROTO_MAX_BODY];  // 10 KB: keep it off the loop stack
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
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------- faces
// Enrolled identities live in the recogniser's own flash-backed store. The
// terminal owns the slot -> trainee mapping; this side only knows slot numbers.
static void faceProcess(camera_fb_t *fb) {
  std::vector<int> shape = {(int)fb->height, (int)fb->width, 3};
  std::list<dl::detect::result_t> candidates =
      g_detector.infer((uint16_t *)fb->buf, shape);
  std::list<dl::detect::result_t> faces =
      g_detector2.infer((uint16_t *)fb->buf, shape, candidates);

  if (faces.empty()) return;

  if (g_enrolTarget >= 0) {
    const int id = g_recogniser->enroll_id((uint16_t *)fb->buf, shape,
                                           faces.front().keypoint, "", true);
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
      // Requested, not applied here: ensureMode() would deinit the camera
      // while this function still borrows fb. loop() applies it after the
      // frame is returned.
      g_wantMode = MODE_IDLE;
    }
    return;
  }

  face_info_t r = g_recogniser->recognize((uint16_t *)fb->buf, shape,
                                          faces.front().keypoint);
  if (r.id > 0) {
    protoSendf(Serial, "%s:%d:%d", EVT_FACE, r.id - 1, (int)(r.similarity * 100));
  } else {
    protoSendf(Serial, "%s:NONE", EVT_FACE);
  }
  g_wantMode = MODE_IDLE;  // one answer per request; the terminal re-arms
}

// ------------------------------------------------------------------- preview
// The terminal's TFT is 320x240, exactly this sensor mode, so the frame is
// JPEG-encoded and sent whole: full screen and in colour, where the old path
// downsampled to a 96x72 grayscale thumbnail to fit a text frame.

// Software JPEG quality is 1-100 (unlike the OV2640 sensor's 0-63 scale).
// FACE frames need conversion; 70 keeps colour/detail without oversized UART
// payloads. QR frames are already JPEG and bypass this encoder entirely.
#define PREVIEW_JPEG_QUALITY 70

// Set by CMD_SNAP: the terminal has drawn the last image and wants the next.
static bool g_snapRequested = false;

static void sendPreview(camera_fb_t *fb) {
  if (!g_previewEnabled || !g_snapRequested) return;
  g_snapRequested = false;

  if (fb->format == PIXFORMAT_JPEG) {
    protoSendImage(Serial, fb->buf, fb->len);
    return;
  }

  uint8_t *jpg = nullptr;
  size_t jpgLen = 0;
  if (!frame2jpg(fb, PREVIEW_JPEG_QUALITY, &jpg, &jpgLen)) {
    reportErr("jpeg encode failed");
    return;
  }
  protoSendImage(Serial, jpg, jpgLen);
  free(jpg);
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
    g_snapRequested = g_previewEnabled;  // send one right away
    return;
  }

  if (is(CMD_SNAP)) {
    g_snapRequested = true;
    return;
  }
}

// ----------------------------------------------------------------------- main
// The default 8 KB loopTask stack is too small once preview frames
// (~10 KB base64) and the ESP-DL calls run in loop(); overflowing it rebooted
// the CAM on the first frame. Kept here, after every other definition,
// because the IDE's prototype generator mistakes this macro for a function.
SET_LOOP_TASK_STACK_SIZE(16 * 1024);

void setup() {
  // Must match CAM_BAUD on the terminal. This is the link, not a console.
  Serial.begin(PROTO_BAUD);
  
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
  static char body[PROTO_MAX_BODY];  // static: see SET_LOOP_TASK_STACK_SIZE
  while (Serial.available()) {
    if (g_reader.feed((char)Serial.read(), body, sizeof(body))) handleFrame(body);
  }

  if (g_wantMode != g_mode) ensureMode(g_wantMode);

  if (g_mode == MODE_IDLE) {
    delay(10);
    return;
  }

  // One capture per pass, shared by the preview and the mode's own work —
  // grabbing twice (as the old previewTick did) doubled the sensor latency.
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    delay(5);
    return;
  }

  if (g_mode == MODE_QR) {
    // Recognition wins over preview. Once a code is found, sending another
    // image only delays the QR event and makes the UI appear stuck.
    if (!qrProcess(fb)) sendPreview(fb);
  } else if (g_mode == MODE_FACE) {
    sendPreview(fb);
    faceProcess(fb);
  }

  esp_camera_fb_return(fb);
}
