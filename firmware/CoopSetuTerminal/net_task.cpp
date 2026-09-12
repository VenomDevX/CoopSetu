// FreeRTOS network task implementation.
//
// Runs on core 0. WiFi + HTTP calls happen here; the UI loop on core 1
// communicates via two FreeRTOS queues (request in, response out).

#include "net_task.h"
#include "config.h"
#include "api.h"
#include "offline.h"

#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <WiFi.h>
#include <ArduinoJson.h>

namespace {

QueueHandle_t g_reqQueue  = nullptr;
QueueHandle_t g_respQueue = nullptr;
TaskHandle_t  g_taskHandle = nullptr;

uint32_t g_lastHeartbeat = 0;
const uint32_t kHeartbeatIntervalMs = 60000;  // 60 seconds

// WiFi reconnect with exponential backoff
bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
    vTaskDelay(pdMS_TO_TICKS(100));
  }
  return WiFi.status() == WL_CONNECTED;
}

void sendResponse(NetRequestType type, bool ok, int status, const char *data) {
  NetResponse resp;
  resp.type = type;
  resp.ok = ok;
  resp.status = status;
  strncpy(resp.data, data, sizeof(resp.data) - 1);
  resp.data[sizeof(resp.data) - 1] = '\0';
  xQueueSend(g_respQueue, &resp, pdMS_TO_TICKS(100));
}

void handleRequest(const NetRequest &req) {
  if (!ensureWifi()) {
    sendResponse(req.type, false, -1, "{\"error\":\"No Wi-Fi\"}");
    return;
  }

  // The payload is pre-formatted by the caller (enqueue site).
  // The api.cpp functions handle the actual HTTP request.
  ApiResult r;

  switch (req.type) {
    case NET_ATTENDANCE_RFID:
      r = apiPostRfidAttendance(req.payload);
      break;
    case NET_ATTENDANCE_QR:
      r = apiMarkAttendance(req.payload, "");  // QR mode: payload is the full body
      break;
    case NET_ATTENDANCE_FACE:
      r = apiPostFaceAttendance(req.payload);
      break;
    case NET_RFID_REGISTER:
      r = apiPostRfidRegister(req.payload);
      break;
    case NET_FETCH_INSTITUTIONS:
      r = apiFetchInstitutions(req.payload);
      break;
    case NET_USER_SEARCH:
      r = apiUserSearch(req.payload);
      break;
    case NET_HEARTBEAT:
      r = apiHeartbeat();
      break;
    default:
      sendResponse(req.type, false, -3, "{\"error\":\"Unknown request type\"}");
      return;
  }

  sendResponse(req.type, r.ok, r.status, r.message);

  // If an attendance request failed (network error or server unreachable),
  // cache it offline so it can be replayed when connectivity returns.
  if (!r.ok && r.status <= 0) {
    // Only cache attendance events — admin actions shouldn't be retried blindly.
    if (req.type == NET_ATTENDANCE_RFID ||
        req.type == NET_ATTENDANCE_QR   ||
        req.type == NET_ATTENDANCE_FACE) {
      char idempKey[37];
      offlineGenerateKey(idempKey, sizeof(idempKey));
      offlinePush(req.payload, idempKey);
    }
  }
}

void netTaskFn(void *) {
  for (;;) {
    NetRequest req;
    if (xQueueReceive(g_reqQueue, &req, pdMS_TO_TICKS(100)) == pdTRUE) {
      handleRequest(req);
    }

    // Periodic heartbeat
    if (millis() - g_lastHeartbeat > kHeartbeatIntervalMs) {
      g_lastHeartbeat = millis();
      if (WiFi.status() == WL_CONNECTED) {
        ApiResult r = apiHeartbeat();
        (void)r;  // heartbeat response is informational, not consumed by UI

        // Drain offline buffer while WiFi is up (max 3 per heartbeat cycle
        // to avoid blocking the request queue for too long).
        int drained = 0;
        while (offlineHasPending() && drained < 3) {
          OfflineEvent ev;
          if (!offlinePop(&ev)) break;

          // Try to replay the event as an RFID attendance call.
          // The idempotency key in the JSON body (or on the server's
          // device_attendance_events UNIQUE constraint) prevents duplicates.
          ApiResult replay = apiPostRfidAttendance(ev.json);
          if (!replay.ok && replay.status <= 0) {
            // Still offline — push it back and stop draining
            offlinePush(ev.json, ev.idempotencyKey);
            break;
          }
          drained++;
        }
      }
    }

    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

}  // namespace

void netTaskBegin() {
  // Initialize offline NVS ring buffer (must happen before task starts)
  offlineBegin();

  g_reqQueue  = xQueueCreate(2, sizeof(NetRequest));
  g_respQueue = xQueueCreate(4, sizeof(NetResponse));

  xTaskCreatePinnedToCore(
    netTaskFn,
    "netTask",
    8192,     // Stack: 8 KB is enough for WiFi+HTTP+JSON on ESP32
    nullptr,
    1,        // Priority: same as loop(), higher than idle
    &g_taskHandle,
    0         // Core 0: WiFi hardware affinity
  );
}

bool netEnqueue(const NetRequest &req) {
  return xQueueSend(g_reqQueue, &req, 0) == pdTRUE;
}

bool netDequeue(NetResponse *resp) {
  return xQueueReceive(g_respQueue, resp, 0) == pdTRUE;
}

bool netWifiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

int netPendingCount() {
  return g_reqQueue ? (2 - uxQueueSpacesAvailable(g_reqQueue)) : 0;
}
