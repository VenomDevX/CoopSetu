// PN532 over the shared VSPI bus.

#ifndef COOPSETU_NFC_H
#define COOPSETU_NFC_H

#include <Arduino.h>

struct NfcCard {
  char uid[21];       // hex, uppercase
  char credential[48]; // CS1 card credential if provisioned, else empty
};

// Returns false if the PN532 never answers (check wiring and that the board's
// DIP switches are set to SPI, not I2C/HSU — the switches, not the firmware,
// decide the interface).
bool nfcBegin();

// True if nfcBegin() found the PN532.
bool nfcReady();

// Non-blocking: true only on the tick a new card is presented. The same card
// held on the reader will not retrigger until it is removed for ~1 s.
bool nfcPoll(NfcCard *out);

// Writes a random CS1 credential to the currently selected NTAG and updates
// card->credential. Used only during admin enrollment.
bool nfcProvisionCredential(NfcCard *card);

#endif  // COOPSETU_NFC_H
