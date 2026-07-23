#include "wifi_creds.h"

#include "esp_log.h"
#include "nvs_flash.h"
#include <stdbool.h>

static const char *TAG = "WIFI_CREDS";
static const char *NVS_NS = "smartplug";
static const char *NVS_KEY_WIFI_SSID = "wifi_ssid";
static const char *NVS_KEY_WIFI_PASS = "wifi_pass";

bool wifi_creds_load(char *ssid_out, size_t ssid_len, char *pass_out, size_t pass_len)
{
    if (ssid_out == NULL || pass_out == NULL || ssid_len == 0 || pass_len == 0) {
        ESP_LOGE(TAG, "Invalid output buffer");
        return false;
    }

    ssid_out[0] = '\0';
    pass_out[0] = '\0';

    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NS, NVS_READONLY, &handle);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "No saved WiFi credentials found");
        return false;
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS open failed: %s", esp_err_to_name(err));
        return false;
    }

    size_t ssid_size = ssid_len;
    err = nvs_get_str(handle, NVS_KEY_WIFI_SSID, ssid_out, &ssid_size);
    if (err != ESP_OK) {
        nvs_close(handle);
        if (err == ESP_ERR_NVS_NOT_FOUND) {
            ESP_LOGI(TAG, "Saved WiFi SSID not found");
        } else {
            ESP_LOGE(TAG, "NVS read failed for SSID: %s", esp_err_to_name(err));
        }
        return false;
    }

    size_t pass_size = pass_len;
    err = nvs_get_str(handle, NVS_KEY_WIFI_PASS, pass_out, &pass_size);
    nvs_close(handle);
    if (err != ESP_OK) {
        if (err == ESP_ERR_NVS_NOT_FOUND) {
            ESP_LOGI(TAG, "Saved WiFi password not found");
        } else {
            ESP_LOGE(TAG, "NVS read failed for password: %s", esp_err_to_name(err));
        }
        return false;
    }

    ESP_LOGI(TAG, "Loaded WiFi credentials for SSID: %s", ssid_out);
    return true;
}

void wifi_creds_save(const char *ssid, const char *password)
{
    if (ssid == NULL || password == NULL) {
        ESP_LOGE(TAG, "Invalid WiFi credentials");
        return;
    }

    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NS, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS open failed: %s", esp_err_to_name(err));
        return;
    }

    err = nvs_set_str(handle, NVS_KEY_WIFI_SSID, ssid);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS write failed for SSID: %s", esp_err_to_name(err));
    }

    if (err == ESP_OK) {
        err = nvs_set_str(handle, NVS_KEY_WIFI_PASS, password);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "NVS write failed for password: %s", esp_err_to_name(err));
        }
    }

    if (err == ESP_OK) {
        err = nvs_commit(handle);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "NVS commit failed: %s", esp_err_to_name(err));
        }
    }

    nvs_close(handle);

    if (err == ESP_OK) {
        ESP_LOGI(TAG, "WiFi credentials saved");
    }
}

void wifi_creds_clear(void)
{
    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NS, NVS_READWRITE, &handle);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "No WiFi credentials namespace to clear");
        return;
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS open failed: %s", esp_err_to_name(err));
        return;
    }

    esp_err_t ssid_err = nvs_erase_key(handle, NVS_KEY_WIFI_SSID);
    if (ssid_err != ESP_OK && ssid_err != ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGE(TAG, "Failed to erase SSID key: %s", esp_err_to_name(ssid_err));
        err = ssid_err;
    }

    esp_err_t pass_err = nvs_erase_key(handle, NVS_KEY_WIFI_PASS);
    if (pass_err != ESP_OK && pass_err != ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGE(TAG, "Failed to erase password key: %s", esp_err_to_name(pass_err));
        err = pass_err;
    }

    if (err == ESP_OK) {
        err = nvs_commit(handle);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "NVS commit failed: %s", esp_err_to_name(err));
        }
    }

    nvs_close(handle);

    if (err == ESP_OK) {
        ESP_LOGI(TAG, "WiFi credentials cleared");
    }
}
