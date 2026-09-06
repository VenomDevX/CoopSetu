Components
ESP32 38 PINS
esp32 cam
PN532
ILI9341 Touch 2.8"
Buzzer
Pushbutton
5V DC Power Supply
Pull-up resistor — labeled 10k pull-up, currently stored as 200 Ω
Green LED
Red LED
Green LED resistor — labeled 220 Ω, currently stored as 200 Ω
Red LED resistor — labeled 220 Ω, currently stored as 200 Ω
No separate MicroSD module is currently in the project.

Power and ground
5V supply Positive → ESP32 VIN
5V supply Positive → ESP32-CAM 5V
5V supply Negative → ESP32 GND
ESP32 GND → ESP32-CAM GND
ESP32 GND → ILI9341 GND
ESP32 GND → PN532 GND
ESP32 GND → Buzzer −
ESP32 GND → Pushbutton Pin 2 (in)
ESP32 GND → Green LED Cathode
ESP32 GND → Red LED Cathode
3.3 V connections
ESP32 3.3 → Pull-up resistor pin2
ESP32 3.3 → ILI9341 VCC
ESP32 3.3 → ILI9341 LED
ESP32 3.3 → PN532 VCC
Green LED
ESP32 GPIO21 → Green LED resistor pin1
Green LED resistor pin2 → Green LED Anode
Green LED Cathode → ESP32 GND
GPIO21 → 220 Ω resistor → Green LED Anode
Green LED Cathode → GND
Red LED
ESP32 GPIO22 → Red LED resistor pin1
Red LED resistor pin2 → Red LED Anode
Red LED Cathode → ESP32 GND
GPIO22 → 220 Ω resistor → Red LED Anode
Red LED Cathode → GND
Pushbutton and pull-up
Pull-up resistor pin1 → ESP32 GPIO34
Pull-up resistor pin2 → ESP32 3.3
ESP32 GPIO34 → Pushbutton Pin 1 (in)
Pushbutton Pin 2 (in) → ESP32 GND
3.3 V → 10 kΩ resistor → GPIO34 → Pushbutton → GND
The wiring topology is correct, but the resistor’s stored value is currently 200 Ω. It must physically be 10 kΩ.

Buzzer
ESP32 GPIO32 → Buzzer +
Buzzer − → common GND
This is suitable only for a confirmed low-current 3.3 V buzzer. A higher-current or 5 V buzzer requires a transistor/MOSFET driver.

ILI9341 Touch TFT
ILI9341 pin	ESP32 pin
CS	GPIO5
D/C	GPIO27
RESET	GPIO4
SD_SCK	GPIO18
SCK	GPIO18
T_CLK	GPIO18
SDI(MOSI)	GPIO23
SD_MOSI	GPIO23
T_DIN	GPIO23
SD_MISO	GPIO19
SDO(MISO)	GPIO19
T_DO	GPIO19
T_CS	GPIO14
T_IRQ	GPIO25
SD_CS	GPIO26
VCC	3.3 V
LED	3.3 V
GND	GND
The missing ILI9341 SD_CS → ESP32 GPIO26 connection has been restored.

PN532 SPI
PN532 pin	ESP32 pin
SCK	GPIO18
MOSI	GPIO23
MISO	GPIO19
SS	GPIO13
VCC	3.3 V
GND	GND
Unconnected PN532 pins:

IRQ
RSTO
SDA / TXD
SCL / RXD
No GPIO33-to-RSTO connection exists.

ESP32 ↔️ ESP32-CAM UART
ESP32 GPIO16 → ESP32-CAM GPIO1
ESP32 GPIO17 → ESP32-CAM GPIO3
ESP32 GND → ESP32-CAM GND
5V supply Positive → ESP32-CAM 5V
ESP32 GPIO16 / RX2 ← ESP32-CAM GPIO1 / TX
ESP32 GPIO17 / TX2 → ESP32-CAM GPIO3 / RX
GND ↔️ GND
Shared SPI bus
ESP32 GPIO18 → TFT SCK + TFT SD_SCK + TFT T_CLK + PN532 SCK
ESP32 GPIO23 → TFT MOSI + TFT SD_MOSI + TFT T_DIN + PN532 MOSI
ESP32 GPIO19 → TFT MISO + TFT SDO(MISO) + TFT T_DO + PN532 MISO
Current limitations
No separate MicroSD component is present.
The project stores the pull-up and LED resistors as 200 Ω, so use the correct physical values: 10 kΩ for the button and 220 Ω for each LED.
The 3.3 V regulator load and buzzer electrical requirements remain unverified.
No simulation or physical electrical test has been performed.