#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <Adafruit_PN532.h>

// =====================================================
// TFT PINS
// =====================================================
#define TFT_CS   5
#define TFT_DC   27
#define TFT_RST  4

// =====================================================
// PN532 PINS
// =====================================================
#define PN532_SS 13

// =====================================================
// SPI PINS
// =====================================================
#define SPI_SCK  18
#define SPI_MISO 19
#define SPI_MOSI 23

// =====================================================
// CREATE DEVICES
// =====================================================
Adafruit_ILI9341 tft(TFT_CS, TFT_DC, TFT_RST);
Adafruit_PN532 nfc(PN532_SS);


// =====================================================
// SETUP
// =====================================================
void setup() {

  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("======================================");
  Serial.println(" ESP32 TFT + PN532 COMBINED TEST");
  Serial.println("======================================");

  // Start SPI bus
  SPI.begin(
    SPI_SCK,
    SPI_MISO,
    SPI_MOSI
  );

  // ---------------------------------------------------
  // TFT TEST
  // ---------------------------------------------------

  Serial.println();
  Serial.println("[1] Starting ILI9341 TFT...");

  tft.begin();

  tft.setRotation(1);

  // RED
  tft.fillScreen(ILI9341_RED);
  delay(500);

  // GREEN
  tft.fillScreen(ILI9341_GREEN);
  delay(500);

  // BLUE
  tft.fillScreen(ILI9341_BLUE);
  delay(500);

  // BLACK
  tft.fillScreen(ILI9341_BLACK);

  Serial.println("TFT: OK");


  // ---------------------------------------------------
  // PN532 TEST
  // ---------------------------------------------------

  Serial.println();
  Serial.println("[2] Starting PN532...");

  nfc.begin();

  uint32_t versiondata = nfc.getFirmwareVersion();

  if (!versiondata) {

    Serial.println("PN532: NOT FOUND!");

    // Show error on TFT
    tft.fillScreen(ILI9341_BLACK);

    tft.setTextColor(ILI9341_RED);
    tft.setTextSize(3);

    tft.setCursor(45, 35);
    tft.println("PN532");

    tft.setTextSize(2);

    tft.setCursor(45, 90);
    tft.println("NOT FOUND!");

    tft.setTextColor(ILI9341_WHITE);

    tft.setCursor(25, 140);
    tft.println("Check SPI wiring");

    while (1) {
      delay(1000);
    }
  }

  Serial.println("PN532: OK");

  // Firmware
  uint8_t ic = (versiondata >> 24) & 0xFF;
  uint8_t ver = (versiondata >> 16) & 0xFF;
  uint8_t rev = (versiondata >> 8) & 0xFF;

  Serial.print("Chip: PN5");
  Serial.println(ic, HEX);

  Serial.print("Firmware: ");
  Serial.print(ver);
  Serial.print(".");
  Serial.println(rev);

  // Configure PN532
  nfc.SAMConfig();


  // ---------------------------------------------------
  // READY SCREEN
  // ---------------------------------------------------

  tft.fillScreen(ILI9341_BLACK);

  // Border
  tft.drawRect(
    5,
    5,
    310,
    230,
    ILI9341_BLUE
  );

  // Title
  tft.setTextColor(ILI9341_GREEN);
  tft.setTextSize(3);

  tft.setCursor(50, 25);
  tft.println("SYSTEM OK");

  // TFT
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(2);

  tft.setCursor(35, 80);
  tft.println("TFT : OK");

  // PN532
  tft.setCursor(35, 115);
  tft.println("PN532 : OK");

  // Instruction
  tft.setTextColor(ILI9341_YELLOW);

  tft.setCursor(25, 175);
  tft.println("SCAN NFC CARD");

  Serial.println();
  Serial.println("======================================");
  Serial.println("SYSTEM READY");
  Serial.println("Place NFC card on PN532...");
  Serial.println("======================================");
}


// =====================================================
// LOOP
// =====================================================
void loop() {

  uint8_t uid[7];
  uint8_t uidLength;


  // Look for ISO14443A card
  bool success = nfc.readPassiveTargetID(
    PN532_MIFARE_ISO14443A,
    uid,
    &uidLength
  );


  if (success) {

    // -------------------------------------------------
    // SERIAL OUTPUT
    // -------------------------------------------------

    Serial.println();
    Serial.println("======================================");
    Serial.println("       NFC CARD DETECTED!");
    Serial.println("======================================");

    Serial.print("UID Length: ");
    Serial.print(uidLength);
    Serial.println(" bytes");

    Serial.print("UID: ");

    for (uint8_t i = 0; i < uidLength; i++) {

      if (uid[i] < 0x10) {
        Serial.print("0");
      }

      Serial.print(uid[i], HEX);

      if (i < uidLength - 1) {
        Serial.print(":");
      }
    }

    Serial.println();
    Serial.println("======================================");


    // -------------------------------------------------
    // TFT DISPLAY
    // -------------------------------------------------

    tft.fillScreen(ILI9341_BLACK);

    tft.drawRect(
      5,
      5,
      310,
      230,
      ILI9341_GREEN
    );

    // Card detected
    tft.setTextColor(ILI9341_GREEN);
    tft.setTextSize(2);

    tft.setCursor(45, 25);
    tft.println("CARD DETECTED!");

    // UID
    tft.setTextColor(ILI9341_WHITE);

    tft.setCursor(25, 75);
    tft.println("UID:");

    // Print UID across lines
    tft.setCursor(25, 110);

    for (uint8_t i = 0; i < uidLength; i++) {

      if (uid[i] < 0x10) {
        tft.print("0");
      }

      tft.print(uid[i], HEX);

      if (i < uidLength - 1) {
        tft.print(":");
      }
    }

    // Status
    tft.setTextColor(ILI9341_YELLOW);

    tft.setCursor(35, 180);
    tft.println("NFC READ SUCCESS");

    delay(2000);


    // Return to ready screen
    tft.fillScreen(ILI9341_BLACK);

    tft.drawRect(
      5,
      5,
      310,
      230,
      ILI9341_BLUE
    );

    tft.setTextColor(ILI9341_GREEN);
    tft.setTextSize(3);

    tft.setCursor(50, 25);
    tft.println("SYSTEM OK");

    tft.setTextColor(ILI9341_WHITE);
    tft.setTextSize(2);

    tft.setCursor(35, 80);
    tft.println("TFT : OK");

    tft.setCursor(35, 115);
    tft.println("PN532 : OK");

    tft.setTextColor(ILI9341_YELLOW);

    tft.setCursor(25, 175);
    tft.println("SCAN NFC CARD");
  }

  delay(100);
}