// PN532 over the shared VSPI bus.

#ifndef COOPSETU_NFC_H
#define COOPSETU_NFC_H

#include <Arduino.h>

struct NfcCard {
  char uid[21];       // hex, uppercase
  char trainee[64];   // NDEF text payload if present, else empty
};

// Returns false if the PN532 never answers (check wiring and that the board's
// DIP switches are set to SPI, not I2C/HSU — the switches, not the firmware,
// decide the interface).
bool nfcBegin();

// Non-blocking: true only on the tick a new card is presented. The same card
// held on the reader will not retrigger until it is removed for ~1 s.
bool nfcPoll(NfcCard *out);

#endif  // COOPSETU_NFC_H
