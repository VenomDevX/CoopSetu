// Offline event buffer — NVS ring for unsent attendance events.
//
// When WiFi is down or the API call fails, attendance events are cached in
// NVS (Preferences). When connectivity returns, the netTask drains the buffer
// oldest-first. Each event carries a client-generated idempotency key, so
// replaying the same event after a partial failure is safe — the backend's
// UNIQUE constraint on idempotency_key makes duplicates a no-op.

#ifndef COOPSETU_OFFLINE_H
#define COOPSETU_OFFLINE_H

#include <Arduino.h>

#define OFFLINE_MAX_EVENTS 50

struct OfflineEvent {
  uint8_t requestType;
  char json[384];  // pre-built JSON body for the API call
  char idempotencyKey[37];  // UUID-like key
};

// Initialize the ring buffer from NVS. Call once from setup().
void offlineBegin();

// Push an event onto the ring buffer. Returns false if full (should not
// happen at 50 events, but the caller can log a warning).
bool offlinePush(uint8_t requestType, const char *json, const char *idempotencyKey);

// Pop the oldest event. Returns false if the buffer is empty.
bool offlinePop(OfflineEvent *out);
bool offlinePeek(OfflineEvent *out);
bool offlineDropOldest();

// Number of events currently buffered.
int offlineCount();

// True if there are events waiting to be replayed.
bool offlineHasPending();
uint32_t offlineDroppedCount();

// Generate a simple idempotency key (ESP32 doesn't have a UUID library).
void offlineGenerateKey(char *buf, size_t bufSize);

#endif  // COOPSETU_OFFLINE_H
