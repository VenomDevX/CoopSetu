// Offline event buffer — NVS ring implementation.
//
// NVS keys:
//   off_head  — int, index of the next slot to read
//   off_tail  — int, index of the next slot to write
//   off_N_j   — String, JSON payload for slot N
//   off_N_k   — String, idempotency key for slot N
//
// The ring wraps at OFFLINE_MAX_EVENTS. Head == tail means empty.

#include "offline.h"
#include <Preferences.h>
#include <esp_random.h>

namespace {

Preferences g_offPrefs;
int g_head = 0;  // next slot to read (oldest)
int g_tail = 0;  // next slot to write (newest + 1)

int wrap(int v) { return v % OFFLINE_MAX_EVENTS; }

int count() {
  int n = g_tail - g_head;
  if (n < 0) n += OFFLINE_MAX_EVENTS;
  return n;
}

}  // namespace

void offlineBegin() {
  g_offPrefs.begin("off", false);
  g_head = g_offPrefs.getInt("off_head", 0);
  g_tail = g_offPrefs.getInt("off_tail", 0);
}

bool offlinePush(const char *json, const char *idempotencyKey) {
  if (count() >= OFFLINE_MAX_EVENTS - 1) {
    // Buffer full — overwrite the oldest event (advance head)
    g_head = wrap(g_head + 1);
    g_offPrefs.putInt("off_head", g_head);
  }

  char jKey[12], kKey[12];
  snprintf(jKey, sizeof(jKey), "off_%d_j", g_tail);
  snprintf(kKey, sizeof(kKey), "off_%d_k", g_tail);

  g_offPrefs.putString(jKey, json);
  g_offPrefs.putString(kKey, idempotencyKey);

  g_tail = wrap(g_tail + 1);
  g_offPrefs.putInt("off_tail", g_tail);

  return true;
}

bool offlinePop(OfflineEvent *out) {
  if (g_head == g_tail) return false;  // empty

  char jKey[12], kKey[12];
  snprintf(jKey, sizeof(jKey), "off_%d_j", g_head);
  snprintf(kKey, sizeof(kKey), "off_%d_k", g_head);

  g_offPrefs.getString(jKey, out->json, sizeof(out->json));
  g_offPrefs.getString(kKey, out->idempotencyKey, sizeof(out->idempotencyKey));

  // Clear the consumed slot
  g_offPrefs.remove(jKey);
  g_offPrefs.remove(kKey);

  g_head = wrap(g_head + 1);
  g_offPrefs.putInt("off_head", g_head);

  return true;
}

int offlineCount() { return count(); }
bool offlineHasPending() { return g_head != g_tail; }

void offlineGenerateKey(char *buf, size_t bufSize) {
  // Generate a pseudo-UUID from ESP32's hardware RNG.
  // Format: 8-4-4-4-12 hex digits
  if (bufSize < 37) { buf[0] = '\0'; return; }

  uint32_t r[4];
  for (int i = 0; i < 4; i++) r[i] = esp_random();

  snprintf(buf, bufSize,
    "%08lx-%04lx-%04lx-%04lx-%08lx%04lx",
    r[0],
    (r[1] >> 16) & 0xFFFF,
    (r[1] & 0x0FFF) | 0x4000,  // version 4
    (r[2] >> 16 & 0x3FFF) | 0x8000,  // variant 1
    r[2] & 0xFFFF, r[3] & 0xFFFF);
  buf[36] = '\0';
}
