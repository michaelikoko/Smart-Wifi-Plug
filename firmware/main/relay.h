#ifndef RELAY_H
#define RELAY_H

#include <stdbool.h>
#include "mqtt_client.h"

void relay_init(void);
// source indicates what triggered the relay change. "app" for MQTT commands, "boot" for initial publish on MQTT connect.
void relay_set_and_publish(esp_mqtt_client_handle_t client, bool state, const char *source);
bool relay_get_state(void);
void relay_save_state(bool state);   // write to NVS
bool relay_load_state(void);         // read from NVS, returns saved state or false as default
#endif