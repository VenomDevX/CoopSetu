#include "nfc.h"
#include "config.h"

#include <SPI.h>
#include <Adafruit_PN532.h>

namespace {

Adafruit_PN532 g_pn532(PIN_PN532_SS);

char g_lastUid[21] = {0};
uint32_t g_lastSeen = 0;
const uint32_t kRepeatLockoutMs = 1000;

void uidToHex(const uint8_t *uid, uint8_t len, char *out, size_t outSize) {
  size_t n = 0;
  for (uint8_t i = 0; i < len && n + 2 < outSize; i++) {
    n += snprintf(out + n, outSize - n, "%02X", uid[i]);
  }
  out[n] = '\0';
}

// Reads an NDEF *Text* record out of an NTAG21x and copies its payload.
//
// Deliberately a hand-rolled minimal parser rather than a full NDEF library:
// the only tag layout this project writes is a single short Text record, and
// the terminal must reject anything else rather than guess. Layout it accepts,
// starting at user memory (page 4):
//
//   03 <len> D1 01 <plen> 54 <status> <lang...> <text...>   FE
//   ^TLV       ^MB/ME/SR/TNF=well-known  ^'T'   ^lang length in low 6 bits
//
// Returns false for anything else, including locked or empty tags, so the
// caller falls back to the UID.
bool readNdefText(char *out, size_t outSize) {
  out[0] = '\0';

  uint8_t buf[64];
  // Pages 4..19 = 64 bytes of user memory; enough for a UUID plus overhead.
  for (uint8_t p = 0; p < 16; p++) {
    if (!g_pn532.ntag2xx_ReadPage(4 + p, buf + p * 4)) return false;
  }

  if (buf[0] != 0x03) return false;  // not an NDEF message TLV
  const uint8_t tlvLen = buf[1];
  if (tlvLen == 0 || tlvLen == 0xFF) return false;  // empty, or 3-byte length
  if ((size_t)tlvLen + 2 > sizeof(buf)) return false;

  const uint8_t *rec = buf + 2;
  const uint8_t header = rec[0];
  const bool shortRecord = header & 0x10;          // SR
  const uint8_t tnf = header & 0x07;               // 0x01 = NFC Forum well-known
  if (!shortRecord || tnf != 0x01) return false;
  if (rec[1] != 0x01) return false;                // type length
  const uint8_t payloadLen = rec[2];
  if (rec[3] != 'T') return false;                 // Text record

  const uint8_t status = rec[4];
  if (status & 0x80) return false;                 // UTF-16: not written by us
  const uint8_t langLen = status & 0x3F;
  if (payloadLen <= 1 + langLen) return false;

  const uint8_t textLen = payloadLen - 1 - langLen;
  if ((size_t)textLen + 1 > outSize) return false;

  memcpy(out, rec + 5 + langLen, textLen);
  out[textLen] = '\0';
  return true;
}

}  // namespace

bool nfcBegin() {
  g_pn532.begin();
  // Ensure TFT is absolutely deselected and decoupled from hardware SS
  pinMode(PIN_TFT_CS, OUTPUT);
  digitalWrite(PIN_TFT_CS, HIGH);
  const uint32_t version = g_pn532.getFirmwareVersion();
  if (!version) return false;

  // One retry per call keeps nfcPoll() short enough not to stall the UI; the
  // default is 0xFF (retry forever), which would block the loop on every tick.
  g_pn532.setPassiveActivationRetries(0x01);
  g_pn532.SAMConfig();
  return true;
}

bool nfcPoll(NfcCard *out) {
  uint8_t uid[7] = {0};
  uint8_t uidLen = 0;

  // 50 ms timeout: long enough to catch a deliberate tap, short enough that the
  // touchscreen still feels responsive.
  if (!g_pn532.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 50)) {
    if (millis() - g_lastSeen > kRepeatLockoutMs) g_lastUid[0] = '\0';
    return false;
  }

  char hex[21];
  uidToHex(uid, uidLen, hex, sizeof(hex));

  const bool same = (strcmp(hex, g_lastUid) == 0);
  g_lastSeen = millis();
  if (same) return false;  // still the same card sitting on the reader

  strncpy(g_lastUid, hex, sizeof(g_lastUid) - 1);
  g_lastUid[sizeof(g_lastUid) - 1] = '\0';

  strncpy(out->uid, hex, sizeof(out->uid) - 1);
  out->uid[sizeof(out->uid) - 1] = '\0';

  if (!readNdefText(out->trainee, sizeof(out->trainee))) out->trainee[0] = '\0';
  return true;
}
