#ifndef CONFIG_H
#define CONFIG_H

// PZEM
//#define ESP_TX_TO_PZEM_RX_PIN 17
//#define ESP_RX_FROM_PZEM_TX_PIN 16
#define ESP_TX_TO_PZEM_RX_PIN 0
#define ESP_RX_FROM_PZEM_TX_PIN 3
#define PZEM_ADDR 0x01 // Default PZEM address

// Relay
//#define RELAY_PIN 18
#define RELAY_PIN 10

// MQTT
#define MQTT_BROKER_URI     "mqtts://53f627ab53774f0b9e7157bfe6b5490c.s1.eu.hivemq.cloud:8883"
#include "mqtt_secrets.h"   // defines MQTT_USERNAME / MQTT_PASSWORD 

// Telemetry
#define TELEMETRY_INTERVAL_MS 10000 // 10s for testing, 30000 for production

// Task priorities
#define PRIORITY_RELAY 5 // highest
#define PRIORITY_PZEM 3
#define PRIORITY_WIFI_MONITOR 2
#define PRIORITY_BUTTON  2

#define BUTTON_PIN   5 

#endif
