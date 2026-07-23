#include "device_id.h"

#include "esp_err.h"
#include "esp_log.h"
#include "esp_mac.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

static const char *TAG = "DEVICE_ID";
static char device_id_buf[32];
static bool device_id_ready = false;

void device_id_init(void)
{
    if (device_id_ready) {
        return;
    }

    uint8_t mac[6] = {0};
    ESP_ERROR_CHECK(esp_efuse_mac_get_default(mac));

    snprintf(device_id_buf, sizeof(device_id_buf),
             "esp32-smartplug-%02X%02X%02X",
             mac[3], mac[4], mac[5]);

    device_id_ready = true;
    ESP_LOGI(TAG, "Device ID: %s", device_id_buf);
}

const char *device_id_get(void)
{
    if (!device_id_ready) {
        device_id_init();
    }

    return device_id_buf;
}
