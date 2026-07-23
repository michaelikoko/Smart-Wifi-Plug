#ifndef WIFI_CREDS_H
#define WIFI_CREDS_H

#include <stdbool.h>
#include <stddef.h>

bool wifi_creds_load(char *ssid_out, size_t ssid_len, char *pass_out, size_t pass_len);
void wifi_creds_save(const char *ssid, const char *password);
void wifi_creds_clear(void);

#endif
