#ifndef MQTT_H
#define MQTT_H

#include "mqtt_client.h"
#include <stdbool.h>

extern esp_mqtt_client_handle_t mqtt_client;
extern bool is_mqtt_connected;

void mqtt_app_start(void);
bool mqtt_is_connected(void);
#endif