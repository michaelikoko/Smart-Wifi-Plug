#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

void wifi_manager_init(void);
void wifi_manager_request_change(const char *ssid, const char *password);

#endif
