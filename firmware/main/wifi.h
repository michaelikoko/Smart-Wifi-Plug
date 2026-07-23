#ifndef WIFI_H
#define WIFI_H

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include <stdbool.h>

#define WIFI_CONNECTED_BIT BIT0

extern EventGroupHandle_t wifi_event_group;
extern volatile bool wifi_suppress_auto_connect;
extern volatile bool wifi_provisioning_mode_active;

void wifi_stack_init(void);
void wifi_init_sta(const char *ssid, const char *password);
#endif
