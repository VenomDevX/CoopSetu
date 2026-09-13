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
  NET_FETCH_INSTITUTIONS,
  NET_USER_SEARCH,
  NET_HEARTBEAT,
};

// Keep payloads small — these live in FreeRTOS queues (static allocation).
struct NetRequest {
  NetRequestType type;
  char payload[384];  // JSON-encoded body or query params
};

struct NetResponse {
  NetRequestType type;
  bool ok;
  int  status;         // HTTP status or negative error
  char data[384];      // JSON response body snippet
};

// Start the network task on core 0. Call once from setup().
void netTaskBegin();

// Enqueue a request from core 1. Non-blocking; returns false if the queue
// is full (previous request still in flight).
bool netEnqueue(const NetRequest &req);

// Poll for a response from core 1. Returns true if a response is available.
bool netDequeue(NetResponse *resp);

// True if WiFi is currently connected (safe to call from any core).
bool netWifiConnected();

// True if a connect attempt is in flight (backoff window elapsed, WiFi.begin()
// issued, not yet resolved). Lets the UI show "Connecting..." instead of a
// flat "No Wi-Fi" while a reconnect is actually underway.
bool netWifiConnecting();

// Number of pending requests in the queue (0 or 1 normally).
int  netPendingCount();

#endif  // COOPSETU_NET_TASK_H
