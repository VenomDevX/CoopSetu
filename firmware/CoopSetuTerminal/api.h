// HTTP client for the CoopSetu attendance API.

#ifndef COOPSETU_API_H
#define COOPSETU_API_H

#include <Arduino.h>

struct ApiResult {
  bool ok;
  int status;         // HTTP status, or a negative HTTPClient error
  char message[160];  // server's `error`, or a local explanation
};

bool wifiBegin(uint32_t timeoutMs);
bool wifiIsUp();

// POST /api/v1/attendance/qr  { qr_token, trainee_id }
ApiResult apiMarkAttendance(const char *qrToken, const char *traineeId);

#endif  // COOPSETU_API_H
