#include "wifi_manager.h"

#include "config.h"
#include "mqtt.h"
#include "mqtt_topics.h"
#include "sntp.h"
#include "wifi.h"
#include "wifi_creds.h"

#include "cJSON.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char ssid[33];
    char password[65];
} wifi_manager_request_t;

static const char *TAG = "WIFI_MGR";
static QueueHandle_t wifi_manager_queue = NULL;

static void build_sta_config(wifi_config_t *cfg, const char *ssid, const char *password)
{
    memset(cfg, 0, sizeof(*cfg));

    size_t ssid_copy_len = strnlen(ssid, sizeof(cfg->sta.ssid));
    memcpy(cfg->sta.ssid, ssid, ssid_copy_len);

    size_t pass_copy_len = strnlen(password, sizeof(cfg->sta.password));
    memcpy(cfg->sta.password, password, pass_copy_len);

    cfg->sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
}

static void publish_wifi_result(const char *status)
{
    if (mqtt_client == NULL) {
        return;
    }

    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        ESP_LOGE(TAG, "Failed to create WiFi result JSON");
        return;
    }

    cJSON_AddStringToObject(root, "status", status);
    cJSON_AddNumberToObject(root, "ts", (double)sntp_get_epoch());

    char *payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (payload == NULL) {
        ESP_LOGE(TAG, "Failed to serialise WiFi result JSON");
        return;
    }

    esp_mqtt_client_publish(mqtt_client, mqtt_topic_pub_wifi_result(),
                            payload, 0, 1, 1);
    free(payload);
}

static bool restore_rollback_connection(const char *rollback_ssid, const char *rollback_password, bool have_rollback)
{
    if (!have_rollback) {
        ESP_LOGW(TAG, "No rollback WiFi credentials available");
        return false;
    }

    wifi_config_t rollback_cfg = {0};
    build_sta_config(&rollback_cfg, rollback_ssid, rollback_password);

    esp_err_t err = esp_wifi_set_config(WIFI_IF_STA, &rollback_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to restore rollback WiFi config: %s", esp_err_to_name(err));
        return false;
    }

    xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);

    err = esp_wifi_connect();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to reconnect to rollback WiFi: %s", esp_err_to_name(err));
        return false;
    }

    EventBits_t bits = xEventGroupWaitBits(wifi_event_group, WIFI_CONNECTED_BIT,
                                            pdFALSE, pdTRUE, pdMS_TO_TICKS(15000));
    return (bits & WIFI_CONNECTED_BIT) != 0;
}

static void wifi_manager_task(void *pvParameters)
{
    (void)pvParameters;

    wifi_manager_request_t request;

    while (1) {
        if (xQueueReceive(wifi_manager_queue, &request, portMAX_DELAY) != pdTRUE) {
            continue;
        }

        wifi_provisioning_mode_active = true;
        wifi_suppress_auto_connect = true;

        char rollback_ssid[33] = {0};
        char rollback_password[65] = {0};
        bool have_rollback = wifi_creds_load(rollback_ssid, sizeof(rollback_ssid),
                                             rollback_password, sizeof(rollback_password));

        esp_wifi_disconnect();
        xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);

        wifi_config_t new_cfg = {0};
        build_sta_config(&new_cfg, request.ssid, request.password);

        esp_err_t err = esp_wifi_set_config(WIFI_IF_STA, &new_cfg);
        wifi_suppress_auto_connect = false;

        if (err == ESP_OK) {
            err = esp_wifi_connect();
        }

        bool success = false;

        if (err == ESP_OK) {
            EventBits_t bits = xEventGroupWaitBits(
                wifi_event_group,
                WIFI_CONNECTED_BIT,
                pdFALSE,
                pdTRUE,
                pdMS_TO_TICKS(15000));

            if ((bits & WIFI_CONNECTED_BIT) != 0) {
                wifi_ap_record_t ap_info = {0};
                esp_err_t ap_err = esp_wifi_sta_get_ap_info(&ap_info);
                if (ap_err == ESP_OK && strcmp((const char *)ap_info.ssid, request.ssid) == 0) {
                    wifi_creds_save(request.ssid, request.password);
                    publish_wifi_result("success");
                    success = true;
                } else if (ap_err != ESP_OK) {
                    ESP_LOGW(TAG, "Connected bit set but unable to read current AP info: %s",
                             esp_err_to_name(ap_err));
                } else {
                    ESP_LOGW(TAG, "Connected to unexpected SSID: %s (expected %s)",
                             (const char *)ap_info.ssid, request.ssid);
                }
            } else {
                ESP_LOGW(TAG, "WiFi connection timed out");
            }
        } else {
            ESP_LOGE(TAG, "Failed to start WiFi connection: %s", esp_err_to_name(err));
        }

        if (!success) {
            bool rollback_success = restore_rollback_connection(rollback_ssid, rollback_password, have_rollback);
            if (rollback_success) {
                ESP_LOGI(TAG, "Rollback WiFi connection restored successfully");
            } else {
                ESP_LOGW(TAG, "Rollback WiFi connection did not recover; device may be stranded without network");
            }
            publish_wifi_result("failed");
        }

        wifi_provisioning_mode_active = false;
    }
}

void wifi_manager_init(void)
{
    if (wifi_manager_queue != NULL) {
        return;
    }

    wifi_manager_queue = xQueueCreate(1, sizeof(wifi_manager_request_t));
    if (wifi_manager_queue == NULL) {
        ESP_LOGE(TAG, "Failed to create WiFi manager queue");
        return;
    }

    BaseType_t ok = xTaskCreate(wifi_manager_task, "wifi_manager_task", 4096,
                                NULL, PRIORITY_WIFI_MONITOR, NULL);
    if (ok != pdPASS) {
        ESP_LOGE(TAG, "Failed to create WiFi manager task");
        vQueueDelete(wifi_manager_queue);
        wifi_manager_queue = NULL;
    }
}

void wifi_manager_request_change(const char *ssid, const char *password)
{
    if (wifi_manager_queue == NULL || ssid == NULL || password == NULL) {
        return;
    }

    wifi_manager_request_t request = {0};
    size_t ssid_len = strnlen(ssid, sizeof(request.ssid) - 1);
    memcpy(request.ssid, ssid, ssid_len);
    request.ssid[ssid_len] = '\0';

    size_t pass_len = strnlen(password, sizeof(request.password) - 1);
    memcpy(request.password, password, pass_len);
    request.password[pass_len] = '\0';

    (void)xQueueSend(wifi_manager_queue, &request, 0);
}
