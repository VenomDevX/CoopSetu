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
  char message[384];  // server's response body or a local explanation
};

// WiFi management (called from netTask)
bool wifiBegin(uint32_t timeoutMs);
bool wifiIsUp();

// POST /api/v1/attendance/qr  { qr_token, trainee_id }
// Legacy session-scoped attendance — payload is pre-built JSON.
ApiResult apiMarkAttendance(const char *qrToken, const char *traineeId);

// POST /api/v1/attendance/rfid  { rfid_uid }
// Kiosk RFID attendance. `jsonBody` is the pre-built JSON payload.
ApiResult apiPostRfidAttendance(const char *jsonBody);

// POST /api/v1/attendance/device-face  { slot, confidence }
ApiResult apiPostFaceAttendance(const char *jsonBody);

// POST /api/v1/rfid/register  { rfid_uid, member_id, organization_id, ... }
ApiResult apiPostRfidRegister(const char *jsonBody);

// GET /api/v1/institutions?organization_id=...
// `queryParams` is the query string (without leading '?').
ApiResult apiFetchInstitutions(const char *queryParams);

// GET /api/v1/users/search?q=&role=&institution_id=
ApiResult apiUserSearch(const char *queryParams);

// POST /api/v1/device/heartbeat
ApiResult apiHeartbeat();

#endif  // COOPSETU_API_H
