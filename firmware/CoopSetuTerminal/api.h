// HTTP client for the CoopSetu attendance API.
//
// All functions in this file run inside the netTask (core 0). They must
// NEVER be called from the main loop (core 1) — use netEnqueue() instead.

#ifndef COOPSETU_API_H
#define COOPSETU_API_H

#include <Arduino.h>

struct ApiResult {
  bool ok;
  int status;         // HTTP status, or a negative HTTPClient error
  // User search is compact JSON for six rows and is parsed by net_task into a
  // fixed page before anything reaches the response queue.
  char message[1024]; // server response body or a local explanation
};

// True if WiFi is currently associated. Connecting/reconnecting is owned by
// net_task.cpp's ensureWifi() state machine, not this file.
bool wifiIsUp();

// POST /api/v1/attendance/qr  { qr_token, trainee_id }
// Legacy session-scoped attendance — payload is pre-built JSON.
ApiResult apiPostQrScan(const char *jsonBody);

// POST /api/v1/attendance/rfid  { rfid_uid }
// Kiosk RFID attendance. `jsonBody` is the pre-built JSON payload.
ApiResult apiPostRfidAttendance(const char *jsonBody);

// POST /api/v1/attendance/device-face  { slot, confidence }
ApiResult apiPostFaceAttendance(const char *jsonBody);

// POST /api/v1/rfid/register  { rfid_uid, member_id, organization_id, ... }
ApiResult apiPostRfidRegister(const char *jsonBody);

// POST/DELETE /api/v1/face-slots for durable CAM slot mappings.
ApiResult apiSyncFaceSlot(const char *jsonBody);
ApiResult apiDeleteFaceSlot(int slot);

// GET /api/v1/users/search?q=&role=&institution_id=
ApiResult apiUserSearch(const char *queryParams);

// POST /api/v1/device/heartbeat
ApiResult apiHeartbeat(const char *jsonBody);

#endif  // COOPSETU_API_H
