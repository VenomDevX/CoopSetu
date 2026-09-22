#include "nfc.h"
#include "config.h"

#include <SPI.h>
#include <Adafruit_PN532.h>
#include <esp_random.h>

// The PN532 sits on the shared SPI bus. Every access is bracketed with
// beginTransaction/endTransaction to protect other devices (ILI9341, XPT2046).

namespace {

Adafruit_PN532 g_nfc(PIN_PN532_SS);
bool g_nfcOk = false;
uint8_t g_lastUid[7] = {0};
uint8_t g_lastUidLen = 0;
uint32_t g_lastReadMs = 0;

// Use the configurable value from config.h. Old hardcoded value was 1000ms
// which was only a debounce — too short for real attendance.
const uint32_t kRepeatLockoutMs = RFID_DEDUPE_MS;

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
    if (!g_nfc.ntag2xx_ReadPage(4 + p, buf + p * 4)) return false;
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

bool nfcReady() { return g_nfcOk; }

bool nfcBegin() {
  g_nfc.begin();
  // Ensure TFT is absolutely deselected and decoupled from hardware SS
  pinMode(PIN_TFT_CS, OUTPUT);
  digitalWrite(PIN_TFT_CS, HIGH);
  const uint32_t version = g_nfc.getFirmwareVersion();
  if (!version) {
    g_nfcOk = false;
    return false;
  }

  // One retry per call keeps nfcPoll() short enough not to stall the UI; the
  // default is 0xFF (retry forever), which would block the loop on every tick.
  g_nfc.setPassiveActivationRetries(0x01);
  g_nfc.SAMConfig();
  g_nfcOk = true;
  return true;
}

bool nfcPoll(NfcCard *out) {
  // Without this guard, a terminal that booted without a responding PN532
  // (see nfcBegin()) would still hit the chip's SPI transfer on every single
  // loop tick from every screen's onTick — forever. That's continuous traffic
  // on the bus the TFT/touch also share, and it's exactly the corruption
  // config.h warns about: the display goes white after the splash and never
  // recovers, because it's fighting a card reader that isn't there.
  if (!g_nfcOk) {
    static uint32_t lastRecoveryMs = 0;
    if (millis() - lastRecoveryMs > 10000) {
      lastRecoveryMs = millis();
      nfcBegin();
    }
    return false;
  }

  uint8_t uid[7] = {0};
  uint8_t uidLen = 0;

  // The timeout is how long the library waits for the InListPassiveTarget
  // *response*, not just the ACK. Activation + anticollision takes tens of ms,
  // so anything much below ~50 ms gives up before the answer arrives and the
  // next poll's command aborts the one in flight — no card is ever read.
  if (!g_nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 50)) {
    if (millis() - g_lastReadMs > kRepeatLockoutMs) {
      memset(g_lastUid, 0, sizeof(g_lastUid));
      g_lastUidLen = 0;
    }
    return false;
  }

  char hex[21];
  uidToHex(uid, uidLen, hex, sizeof(hex));

  // Compare with the last-seen UID to suppress repeat reads from the same card
  // sitting on the reader surface.
  const bool same = (uidLen == g_lastUidLen && memcmp(uid, g_lastUid, uidLen) == 0);
  g_lastReadMs = millis();
  if (same) return false;

  memcpy(g_lastUid, uid, uidLen);
  g_lastUidLen = uidLen;

  strncpy(out->uid, hex, sizeof(out->uid) - 1);
  out->uid[sizeof(out->uid) - 1] = '\0';

  char text[48] = {0};
  if (readNdefText(text, sizeof(text)) && strncmp(text, "CS1:", 4) == 0) {
    strncpy(out->credential, text, sizeof(out->credential) - 1);
  } else {
    out->credential[0] = '\0';
  }
  return true;
}

bool nfcProvisionCredential(NfcCard *card) {
  if (!g_nfcOk || !card) return false;
  uint8_t randomBytes[16];
  for (uint8_t i = 0; i < sizeof(randomBytes); i += 4) {
    const uint32_t value = esp_random();
    memcpy(randomBytes + i, &value, 4);
  }
  char text[37] = "CS1:";
  for (uint8_t i = 0; i < sizeof(randomBytes); i++) {
    snprintf(text + 4 + i * 2, sizeof(text) - 4 - i * 2, "%02X", randomBytes[i]);
  }

  uint8_t ndef[64] = {0};
  const uint8_t textLen = strlen(text);
  const uint8_t payloadLen = 3 + textLen; // status + "en" + text
  const uint8_t recordLen = 4 + payloadLen;
  ndef[0] = 0x03;
  ndef[1] = recordLen;
  ndef[2] = 0xD1;
  ndef[3] = 0x01;
  ndef[4] = payloadLen;
  ndef[5] = 'T';
  ndef[6] = 0x02;
  ndef[7] = 'e';
  ndef[8] = 'n';
  memcpy(ndef + 9, text, textLen);
  ndef[9 + textLen] = 0xFE;
  const size_t bytes = 10 + textLen;
  for (uint8_t page = 0; page < (bytes + 3) / 4; page++) {
    if (!g_nfc.ntag2xx_WritePage(4 + page, ndef + page * 4)) return false;
  }
  strncpy(card->credential, text, sizeof(card->credential) - 1);
  card->credential[sizeof(card->credential) - 1] = '\0';
  return true;
}
