#include "api.h"
#include "config.h"

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

namespace {

const bool kUseTls = (strncmp(API_BASE_URL, "https://", 8) == 0);

// Copies `src` into a JSON string body with the characters JSON forbids
// escaped. Only the ones that can appear in a QR payload or a UUID are handled
// — control characters are dropped rather than escaped, since a token
// containing them is malformed anyway.
void jsonEscape(const char *src, char *dst, size_t dstSize) {
  size_t j = 0;
  for (size_t i = 0; src[i] && j + 2 < dstSize; i++) {
    const char c = src[i];
    if (c == '"' || c == '\\') {
      dst[j++] = '\\';
      dst[j++] = c;
    } else if ((uint8_t)c >= 0x20) {
      dst[j++] = c;
    }
  }
  dst[j] = '\0';
}

}  // namespace

bool wifiBegin(uint32_t timeoutMs) {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // sleep adds seconds of latency to a tap-and-go flow
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) delay(100);
  return WiFi.status() == WL_CONNECTED;
}

bool wifiIsUp() { return WiFi.status() == WL_CONNECTED; }

ApiResult apiMarkAttendance(const char *qrToken, const char *traineeId) {
  ApiResult r = {false, 0, ""};

  if (!wifiIsUp() && !wifiBegin(6000)) {
    r.status = -1;
    strncpy(r.message, "No Wi-Fi", sizeof(r.message) - 1);
    return r;
  }

  char url[160];
  snprintf(url, sizeof(url), "%s/api/v1/attendance/qr", API_BASE_URL);

  char tokenEsc[192], traineeEsc[80];
  jsonEscape(qrToken, tokenEsc, sizeof(tokenEsc));
  jsonEscape(traineeId, traineeEsc, sizeof(traineeEsc));

  char body[320];
  snprintf(body, sizeof(body), "{\"qr_token\":\"%s\",\"trainee_id\":\"%s\"}",
           tokenEsc, traineeEsc);

  HTTPClient http;
  bool began = false;

  // WiFiClientSecure must outlive the request, so it is declared here rather
  // than inside the branch.
  WiFiClientSecure tls;
  WiFiClient plain;
  if (kUseTls) {
#if API_TLS_INSECURE
    tls.setInsecure();
#endif
    began = http.begin(tls, url);
  } else {
    began = http.begin(plain, url);
  }

  if (!began) {
    r.status = -2;
    strncpy(r.message, "Bad API URL", sizeof(r.message) - 1);
    return r;
  }

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " API_DEVICE_TOKEN);
  // middleware.ts 403s empty, curl and python-requests user-agents on
  // /api/v1/*. This one is none of those; do not shorten it to "ESP32".
  http.addHeader("User-Agent", "Mozilla/5.0 (compatible; CoopSetuTerminal/1)");

  const int code = http.POST((uint8_t *)body, strlen(body));
  r.status = code;

  if (code <= 0) {
    snprintf(r.message, sizeof(r.message), "Network error %d", code);
    http.end();
    return r;
  }

  const String payload = http.getString();
  http.end();

  if (code == 201 || code == 200) {
    r.ok = true;
    StaticJsonDocument<384> doc;
    if (deserializeJson(doc, payload) == DeserializationError::Ok) {
      const char *name = doc["data"]["trainees"]["profiles"]["full_name"] | "Attendance marked";
      strncpy(r.message, name, sizeof(r.message) - 1);
    } else {
      strncpy(r.message, "Attendance marked", sizeof(r.message) - 1);
    }
    r.message[sizeof(r.message) - 1] = '\0';
    return r;
  }

  // Surface the server's own message; it is the useful half of a 400.
  StaticJsonDocument<384> doc;
  if (deserializeJson(doc, payload) == DeserializationError::Ok) {
    const char *err = doc["error"] | "";
    if (*err) {
      strncpy(r.message, err, sizeof(r.message) - 1);
      r.message[sizeof(r.message) - 1] = '\0';
      return r;
    }
  }
  snprintf(r.message, sizeof(r.message), "HTTP %d", code);
  return r;
}
