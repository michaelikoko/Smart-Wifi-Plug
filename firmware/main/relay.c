#include <stdio.h>
#include "relay.h"
#include "config.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "cJSON.h"
#include "sntp.h"
#include "nvs_flash.h"

static const char *TAG = "RELAY";
static bool volatile relay_state = false;

static const char *NVS_NS      = "smartplug";   // NVS namespace
static const char *NVS_KEY     = "relay_state"; // NVS key

void relay_save_state(bool state)
{
    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NS, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS open failed: %s", esp_err_to_name(err));
        return;
    }

    err = nvs_set_u8(handle, NVS_KEY, state ? 1 : 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS write failed: %s", esp_err_to_name(err));
    }

    err = nvs_commit(handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS commit failed: %s", esp_err_to_name(err));
    }

    nvs_close(handle);
    ESP_LOGI(TAG, "Relay state saved to NVS: %s", state ? "ON" : "OFF");
}

bool relay_load_state(void)
{
    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NS, NVS_READONLY, &handle);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        // Namespace doesn't exist yet — first boot, return safe default
        ESP_LOGI(TAG, "No saved relay state found — defaulting to OFF");
        return false;
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS open failed: %s", esp_err_to_name(err));
        return false;
    }

    uint8_t value = 0;
    err = nvs_get_u8(handle, NVS_KEY, &value);
    nvs_close(handle);

    if (err == ESP_ERR_NVS_NOT_FOUND) {
        // Key doesn't exist yet — first boot
        ESP_LOGI(TAG, "No saved relay state found — defaulting to OFF");
        return false;
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS read failed: %s", esp_err_to_name(err));
        return false;
    }

    ESP_LOGI(TAG, "Relay state loaded from NVS: %s", value ? "ON" : "OFF");
    return value == 1;
}

void relay_init(void)
{
    gpio_reset_pin(RELAY_PIN);
    gpio_set_direction(RELAY_PIN, GPIO_MODE_OUTPUT);

    // Load last saved state from NVS
    relay_state = relay_load_state();

    // Apply the loaded state to GPIO immediately
    gpio_set_level(RELAY_PIN, relay_state ? 1 : 0);

    ESP_LOGI(TAG, "Relay initialized — %s (restored from NVS)",
             relay_state ? "ON" : "OFF");

    //gpio_set_level(RELAY_PIN, 0); // default OFF
    //// Maybe read initial state from NVS or some other history
    //relay_state = false;

    //ESP_LOGI(TAG, "Relay initialized — OFF");
}

void relay_set_and_publish(esp_mqtt_client_handle_t client, bool state, const char *source)
{
    gpio_set_level(RELAY_PIN, state ? 1 : 0);
    relay_state = state;
    ESP_LOGI(TAG, "Relay → %s", state ? "ON" : "OFF");

    // char payload[32];
    // snprintf(payload, sizeof(payload), "{\"state\":\"%s\"}", state ? "ON" : "OFF");

    // Persist new state to NVS
    relay_save_state(state);

    char payload[96];
    snprintf(payload, sizeof(payload),
             "{\"state\":\"%s\",\"source\":\"%s\",\"ts\":%lld}",
             state ? "ON" : "OFF",
             source,
             (long long)sntp_get_epoch());

    esp_mqtt_client_publish(client, MQTT_TOPIC_PUB_RELAY_STATE,
                            payload, 0, 1, 1);
}

bool relay_get_state(void)
{
    return relay_state;
}