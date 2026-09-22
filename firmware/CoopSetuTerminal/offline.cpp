#include "offline.h"

#include <Preferences.h>
#include <esp_random.h>

namespace {
Preferences g_offPrefs;
int g_head = 0;
int g_tail = 0;
uint32_t g_dropped = 0;

int wrap(int value) { return value % OFFLINE_MAX_EVENTS; }
int count() {
  int value = g_tail - g_head;
  return value < 0 ? value + OFFLINE_MAX_EVENTS : value;
}

void keysFor(int index, char *jsonKey, char *idKey, char *typeKey) {
  snprintf(jsonKey, 12, "off_%d_j", index);
  snprintf(idKey, 12, "off_%d_k", index);
  snprintf(typeKey, 12, "off_%d_t", index);
}
}  // namespace

void offlineBegin() {
  g_offPrefs.begin("off", false);
  g_head = g_offPrefs.getInt("off_head", 0);
  g_tail = g_offPrefs.getInt("off_tail", 0);
  g_dropped = g_offPrefs.getUInt("off_drop", 0);
}

bool offlinePush(uint8_t requestType, const char *json, const char *idempotencyKey) {
  if (count() >= OFFLINE_MAX_EVENTS - 1) {
    g_dropped++;
    g_offPrefs.putUInt("off_drop", g_dropped);
    return false;
  }
  char jsonKey[12], idKey[12], typeKey[12];
  keysFor(g_tail, jsonKey, idKey, typeKey);
  g_offPrefs.putString(jsonKey, json);
  g_offPrefs.putString(idKey, idempotencyKey);
  g_offPrefs.putUChar(typeKey, requestType);
  g_tail = wrap(g_tail + 1);
  g_offPrefs.putInt("off_tail", g_tail);
  return true;
}

bool offlinePeek(OfflineEvent *out) {
  if (!out || g_head == g_tail) return false;
  char jsonKey[12], idKey[12], typeKey[12];
  keysFor(g_head, jsonKey, idKey, typeKey);
  g_offPrefs.getString(jsonKey, out->json, sizeof(out->json));
  g_offPrefs.getString(idKey, out->idempotencyKey, sizeof(out->idempotencyKey));
  out->requestType = g_offPrefs.getUChar(typeKey, 0);
  return true;
}

bool offlineDropOldest() {
  if (g_head == g_tail) return false;
  char jsonKey[12], idKey[12], typeKey[12];
  keysFor(g_head, jsonKey, idKey, typeKey);
  g_offPrefs.remove(jsonKey);
  g_offPrefs.remove(idKey);
  g_offPrefs.remove(typeKey);
  g_head = wrap(g_head + 1);
  g_offPrefs.putInt("off_head", g_head);
  return true;
}

bool offlinePop(OfflineEvent *out) { return offlinePeek(out) && offlineDropOldest(); }
int offlineCount() { return count(); }
bool offlineHasPending() { return g_head != g_tail; }
uint32_t offlineDroppedCount() { return g_dropped; }

void offlineGenerateKey(char *buf, size_t bufSize) {
  if (bufSize < 37) { buf[0] = '\0'; return; }
  uint32_t r[4];
  for (int i = 0; i < 4; i++) r[i] = esp_random();
  snprintf(buf, bufSize, "%08lx-%04lx-%04lx-%04lx-%08lx%04lx",
           r[0], (r[1] >> 16) & 0xFFFF, (r[1] & 0x0FFF) | 0x4000,
           ((r[2] >> 16) & 0x3FFF) | 0x8000, r[2] & 0xFFFF, r[3] & 0xFFFF);
  buf[36] = '\0';
}
