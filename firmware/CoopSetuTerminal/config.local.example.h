#ifndef COOPSETU_CONFIG_LOCAL_H
#define COOPSETU_CONFIG_LOCAL_H

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define API_BASE_URL "https://attendance.example.org"
#define API_DEVICE_TOKEN "PROVISION_A_UNIQUE_DEVICE_TOKEN"
#define API_TLS_INSECURE 0
#define API_ALLOW_PLAINTEXT_HTTP 0
// PEM root certificate for the API hostname. Keep the line breaks escaped.
#define API_ROOT_CA "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"

#endif
