#ifndef CONFIG_H
#define CONFIG_H

// PZEM
#define ESP_TX_TO_PZEM_RX_PIN 17
#define ESP_RX_FROM_PZEM_TX_PIN 16
#define PZEM_ADDR 0x01 // Default PZEM address

// Relay
#define RELAY_PIN 18

// WiFi - I'll change this later to read from nvs flash memory
#define WIFI_SSID       "Wokwi-GUEST"
#define WIFI_PASSWORD   ""

// MQTT
#define SMARTPLUG_ID        "esp32-smartplug-001" // Dummy unique ID for now
#define MQTT_BROKER_URI     "mqtt://broker.hivemq.com:1883"
#define MQTT_TOPIC_PREFIX   "smartplug/" SMARTPLUG_ID

// Publish device status -> Payload: {"status": "offline"} or {"status": "online"}
#define MQTT_TOPIC_PUB_DEVICE_STATUS    MQTT_TOPIC_PREFIX "/status"

// Publish current relay state -> Payload: {"state": "ON"|"OFF", "source": "app"|"button"|"boot", "ts": 1234567890} 
#define MQTT_TOPIC_PUB_RELAY_STATE      MQTT_TOPIC_PREFIX "/relay/state"

// Publish telemetry data (voltage, current, power, etc.) -> Payload: {"voltage": 230.5, "current": 0.5, "power": 115.25, "energy": 1.234, "frequency": 50.0, "pf": 0.95}
#define MQTT_TOPIC_PUB_TELEMETRY        MQTT_TOPIC_PREFIX "/telemetry"

// Subscribe for relay control commands -> Payload: {"cmd": "ON"}, {"cmd": "OFF"}, or {"cmd": "TOGGLE"}
#define MQTT_TOPIC_SUB_RELAY_CONTROL    MQTT_TOPIC_PREFIX "/relay/command"

// Telemetry
#define TELEMETRY_INTERVAL_MS 10000 // 10s for testing, 30000 for production

// Task priorities
#define PRIORITY_RELAY 5 // highest
#define PRIORITY_PZEM 3
#define PRIORITY_WIFI_MONITOR 2
#define PRIORITY_BUTTON  2

#define BUTTON_PIN   4   

#endif