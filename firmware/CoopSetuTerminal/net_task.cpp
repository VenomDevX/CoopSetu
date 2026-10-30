#include "net_task.h"
#include "config.h"
#include "api.h"
#include "offline.h"
#include "camlink.h"
#include "nfc.h"

#include <ArduinoJson.h>
#include <WiFi.h>
#include <esp_system.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include <time.h>

namespace {
QueueHandle_t g_reqQueue = nullptr;
QueueHandle_t g_respQueue = nullptr;
TaskHandle_t g_taskHandle = nullptr;
uint32_t g_lastHeartbeat = 0;
const uint32_t kHeartbeatIntervalMs = 60000;
volatile bool g_checkNow = true;
volatile uint32_t g_srvLastCheckMs = 0;
volatile uint32_t g_srvLastOkMs = 0;
volatile int g_srvLastStatus = 0;
volatile uint32_t g_nextRequestId = 1;

NetUserPageEntry g_userPage[NET_USER_PAGE_SIZE];
volatile uint8_t g_userPageCount = 0;
volatile int g_userPageOffset = 0;
volatile int g_userPageTotal = 0;
volatile bool g_userPageHasMore = false;

NetResponse g_stash[6];
uint8_t g_stashCount = 0;

bool g_wifiConnecting = false;
bool g_clockStarted = false;
uint32_t g_wifiLastAttemptMs = 0;
uint32_t g_wifiBackoffMs = 2000;
const uint32_t kWifiBackoffMaxMs = 30000;

bool isAttendance(NetRequestType type) {
  return type == NET_ATTENDANCE_RFID || type == NET_ATTENDANCE_QR || type == NET_ATTENDANCE_FACE;
}

bool parseUserPage(const char *json) {
  StaticJsonDocument<1536> doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return false;
  JsonArray users = doc["users"].as<JsonArray>();
  g_userPageCount = min((size_t)NET_USER_PAGE_SIZE, users.size());
  for (uint8_t i = 0; i < g_userPageCount; i++) {
    strncpy(g_userPage[i].id, users[i]["id"] | "", sizeof(g_userPage[i].id) - 1);
    g_userPage[i].id[sizeof(g_userPage[i].id) - 1] = '\0';
    strncpy(g_userPage[i].name, users[i]["name"] | "Unknown", sizeof(g_userPage[i].name) - 1);
    g_userPage[i].name[sizeof(g_userPage[i].name) - 1] = '\0';
    g_userPage[i].hasRfid = users[i]["has_rfid"] | false;
  }
  g_userPageOffset = doc["offset"] | 0;
  g_userPageTotal = doc["total"] | (int)g_userPageCount;
  g_userPageHasMore = doc["has_more"] | false;
  return true;
}

void noteServerResult(const ApiResult &result) {
  const uint32_t now = millis();
  g_srvLastCheckMs = now ? now : 1;
  g_srvLastStatus = result.status;
  if (result.status > 0 && result.status < 500) g_srvLastOkMs = g_srvLastCheckMs;
}

bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    g_wifiConnecting = false;
    g_wifiBackoffMs = 2000;
    if (!g_clockStarted) {
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      g_clockStarted = true;
    }
    return true;
  }
  const uint32_t now = millis();
  if (!g_wifiConnecting || now - g_wifiLastAttemptMs >= g_wifiBackoffMs) {
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    g_wifiConnecting = true;
    g_wifiLastAttemptMs = now;
    g_wifiBackoffMs = min(g_wifiBackoffMs * 2, kWifiBackoffMaxMs);
  }
  return false;
}

void isoNow(char *out, size_t size) {
  const time_t now = time(nullptr);
  if (now < 1700000000) { out[0] = '\0'; return; }
  struct tm utc;
  gmtime_r(&now, &utc);
  strftime(out, size, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

void addAttendanceMetadata(NetRequest *req) {
  if (!isAttendance(req->type) || strstr(req->payload, "idempotency_key")) return;
  const size_t len = strlen(req->payload);
  if (len < 2 || req->payload[len - 1] != '}') return;
  char key[37], capturedAt[24], enriched[sizeof(req->payload)];
  offlineGenerateKey(key, sizeof(key));
  isoNow(capturedAt, sizeof(capturedAt));
  if (capturedAt[0]) {
    snprintf(enriched, sizeof(enriched), "%.*s,\"idempotency_key\":\"%s\",\"captured_at\":\"%s\"}",
             (int)(len - 1), req->payload, key, capturedAt);
  } else {
    snprintf(enriched, sizeof(enriched), "%.*s,\"idempotency_key\":\"%s\"}",
             (int)(len - 1), req->payload, key);
  }
  strncpy(req->payload, enriched, sizeof(req->payload) - 1);
  req->payload[sizeof(req->payload) - 1] = '\0';
}

void buildHeartbeat(char *out, size_t size) {
  CamLinkStats cam;
  camGetStats(&cam);
  char bootedAt[24] = {0};
  const time_t now = time(nullptr);
  if (now >= 1700000000) {
    const time_t boot = now - (millis() / 1000);
    struct tm utc;
    gmtime_r(&boot, &utc);
    strftime(bootedAt, sizeof(bootedAt), "%Y-%m-%dT%H:%M:%SZ", &utc);
  }
  snprintf(out, size,
    "{\"firmware_version\":\"%s\",\"booted_at\":\"%s\",\"reset_reason\":\"%d\",\"telemetry\":{"
    "\"rssi\":%d,\"free_heap\":%u,\"min_free_heap\":%u,\"cam_alive\":%s,"
    "\"cam_frames\":%lu,\"cam_bad_frames\":%lu,\"nfc_ready\":%s,"
    "\"offline_pending\":%d,\"offline_dropped\":%lu}}",
    FIRMWARE_VERSION, bootedAt, (int)esp_reset_reason(), WiFi.RSSI(), ESP.getFreeHeap(),
    ESP.getMinFreeHeap(), camIsAlive() ? "true" : "false",
    (unsigned long)cam.framesOk, (unsigned long)cam.badFrames,
    nfcReady() ? "true" : "false", offlineCount(),
    (unsigned long)offlineDroppedCount());
}

void sendResponse(uint32_t id, NetRequestType type, bool ok, int status, const char *data) {
  NetResponse response{};
  response.requestId = id;
  response.type = type;
  response.ok = ok;
  response.status = status;
  strncpy(response.data, data, sizeof(response.data) - 1);
  xQueueSend(g_respQueue, &response, pdMS_TO_TICKS(100));
}

bool cacheOffline(const NetRequest &req) {
  if (!isAttendance(req.type) || !strstr(req.payload, "captured_at")) return false;
  return offlinePush((uint8_t)req.type, req.payload, "");
}

ApiResult attendanceApi(uint8_t type, const char *payload) {
  if (type == NET_ATTENDANCE_QR) return apiPostQrScan(payload);
  if (type == NET_ATTENDANCE_FACE) return apiPostFaceAttendance(payload);
  return apiPostRfidAttendance(payload);
}

void handleRequest(const NetRequest &req) {
  if (!ensureWifi()) {
    const bool saved = cacheOffline(req);
    sendResponse(req.requestId, req.type, false, -1,
      saved
        ? "{\"error\":\"offline\",\"message\":\"No Wi-Fi. Saved for ordered sync.\"}"
        : "{\"error\":\"offline\",\"message\":\"Not saved: clock unsynced or queue full.\"}");
    return;
  }

  ApiResult result;
  switch (req.type) {
    case NET_ATTENDANCE_RFID: result = apiPostRfidAttendance(req.payload); break;
    case NET_ATTENDANCE_QR: result = apiPostQrScan(req.payload); break;
    case NET_ATTENDANCE_FACE: result = apiPostFaceAttendance(req.payload); break;
    case NET_RFID_REGISTER: result = apiPostRfidRegister(req.payload); break;
    case NET_USER_SEARCH: result = apiUserSearch(req.payload); break;
    case NET_FACE_SLOT_SYNC: result = apiSyncFaceSlot(req.payload); break;
    case NET_FACE_SLOT_DELETE: result = apiDeleteFaceSlot(atoi(req.payload)); break;
    case NET_HEARTBEAT: result = apiHeartbeat(req.payload); break;
    default:
      sendResponse(req.requestId, req.type, false, -3, "{\"error\":\"Unknown request type\"}");
      return;
  }

  if (req.type == NET_USER_SEARCH && result.ok) {
    if (parseUserPage(result.message)) {
      snprintf(result.message, sizeof(result.message),
               "{\"count\":%u,\"offset\":%d,\"total\":%d,\"has_more\":%s}",
               g_userPageCount, g_userPageOffset, g_userPageTotal,
               g_userPageHasMore ? "true" : "false");
    } else {
      result.ok = false;
      result.status = -4;
      strncpy(result.message, "{\"error\":\"Invalid user page\"}", sizeof(result.message) - 1);
    }
  }
  noteServerResult(result);
  sendResponse(req.requestId, req.type, result.ok, result.status, result.message);
  if (!result.ok && result.status <= 0) cacheOffline(req);
}

void netTaskFn(void *) {
  for (;;) {
    NetRequest request;
    if (xQueueReceive(g_reqQueue, &request, pdMS_TO_TICKS(100)) == pdTRUE) handleRequest(request);

    const bool wifiUp = WiFi.status() == WL_CONNECTED;
    if ((g_checkNow && wifiUp) || millis() - g_lastHeartbeat > kHeartbeatIntervalMs) {
      g_lastHeartbeat = millis();
      if (wifiUp) {
        g_checkNow = false;
        char heartbeat[512];
        buildHeartbeat(heartbeat, sizeof(heartbeat));
        noteServerResult(apiHeartbeat(heartbeat));
        int drained = 0;
        while (offlineHasPending() && drained < 3) {
          OfflineEvent event;
          if (!offlinePeek(&event)) break;
          ApiResult replay = attendanceApi(event.requestType, event.json);
          if (!replay.ok && replay.status <= 0) break;
          offlineDropOldest();
          drained++;
        }
      } else {
        ensureWifi();
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}
}  // namespace

void netTaskBegin() {
  offlineBegin();
  g_reqQueue = xQueueCreate(4, sizeof(NetRequest));
  g_respQueue = xQueueCreate(8, sizeof(NetResponse));
  xTaskCreatePinnedToCore(netTaskFn, "netTask", 10240, nullptr, 1, &g_taskHandle, 0);
}

uint32_t netEnqueue(NetRequest &request) {
  request.requestId = g_nextRequestId++;
  if (!request.requestId) request.requestId = g_nextRequestId++;
  addAttendanceMetadata(&request);
  return xQueueSend(g_reqQueue, &request, 0) == pdTRUE ? request.requestId : 0;
}

bool netDequeueFor(uint32_t requestId, NetResponse *response) {
  for (uint8_t i = 0; i < g_stashCount; i++) {
    if (g_stash[i].requestId != requestId) continue;
    *response = g_stash[i];
    for (uint8_t j = i + 1; j < g_stashCount; j++) g_stash[j - 1] = g_stash[j];
    g_stashCount--;
    return true;
  }
  NetResponse candidate;
  while (xQueueReceive(g_respQueue, &candidate, 0) == pdTRUE) {
    if (candidate.requestId == requestId) { *response = candidate; return true; }
    if (g_stashCount < 6) g_stash[g_stashCount++] = candidate;
  }
  return false;
}

bool netWifiConnected() { return WiFi.status() == WL_CONNECTED; }
bool netWifiConnecting() { return g_wifiConnecting && WiFi.status() != WL_CONNECTED; }
NetServerHealth netServerHealth() { return {g_srvLastCheckMs, g_srvLastOkMs, g_srvLastStatus}; }
void netCheckServerNow() { g_checkNow = true; }
int netPendingCount() { return g_reqQueue ? (4 - uxQueueSpacesAvailable(g_reqQueue)) : 0; }
uint8_t netUserPageCount() { return g_userPageCount; }
const NetUserPageEntry* netUserPageEntry(uint8_t index) { return index < g_userPageCount ? &g_userPage[index] : nullptr; }
int netUserPageOffset() { return g_userPageOffset; }
int netUserPageTotal() { return g_userPageTotal; }
bool netUserPageHasMore() { return g_userPageHasMore; }
