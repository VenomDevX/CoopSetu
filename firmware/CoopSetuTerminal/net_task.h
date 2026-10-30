// FreeRTOS network task — offloads blocking WiFi/HTTP to core 0.
//
// The main loop on core 1 (display/touch/NFC/CAM-link) posts request structs
// to a queue and polls for responses. This eliminates the ~14 s UI freeze
// risk from inline wifiBegin() + apiMarkAttendance() calls.

#ifndef COOPSETU_NET_TASK_H
#define COOPSETU_NET_TASK_H

#include <Arduino.h>

enum NetRequestType {
  NET_ATTENDANCE_RFID,
  NET_ATTENDANCE_QR,
  NET_ATTENDANCE_FACE,
  NET_RFID_REGISTER,
  NET_USER_SEARCH,
  NET_FACE_SLOT_SYNC,
  NET_FACE_SLOT_DELETE,
  NET_HEARTBEAT,
};

// Keep payloads small — these live in FreeRTOS queues (static allocation).
struct NetRequest {
  uint32_t requestId;
  NetRequestType type;
  char payload[384];  // JSON-encoded body or query params
};

struct NetResponse {
  uint32_t requestId;
  NetRequestType type;
  bool ok;
  int  status;         // HTTP status or negative error
  char data[384];      // JSON response body snippet
};

static const uint8_t NET_USER_PAGE_SIZE = 6;
struct NetUserPageEntry {
  char id[40];
  char name[42];
  bool hasRfid;
};

// The network task parses user-search JSON into this fixed page. The display
// reads it only after receiving the matching NET_USER_SEARCH response.
uint8_t netUserPageCount();
const NetUserPageEntry* netUserPageEntry(uint8_t index);
int netUserPageOffset();
int netUserPageTotal();
bool netUserPageHasMore();

// Start the network task on core 0. Call once from setup().
void netTaskBegin();

// Enqueue a request from core 1. Non-blocking; returns false if the queue
// is full (previous request still in flight).
uint32_t netEnqueue(NetRequest &req);

// Poll for a response from core 1. Returns true if a response is available.
bool netDequeueFor(uint32_t requestId, NetResponse *resp);

// True if WiFi is currently connected (safe to call from any core).
bool netWifiConnected();

// True if a connect attempt is in flight (backoff window elapsed, WiFi.begin()
// issued, not yet resolved). Lets the UI show "Connecting..." instead of a
// flat "No Wi-Fi" while a reconnect is actually underway.
bool netWifiConnecting();

// Number of pending requests in the queue (0 or 1 normally).
int  netPendingCount();

// Result of the most recent call to the CoopSetu server (heartbeat or any
// request). lastCheckMs == 0 means the server has not been contacted yet.
struct NetServerHealth {
  uint32_t lastCheckMs;  // millis() of the last attempt
  uint32_t lastOkMs;     // millis() of the last 2xx/4xx reply (server reachable)
  int      lastStatus;   // HTTP status, or negative HTTPClient error
};
NetServerHealth netServerHealth();

// Ask the network task to send a heartbeat on its next loop instead of
// waiting for the 60 s interval.
void netCheckServerNow();

#endif  // COOPSETU_NET_TASK_H
