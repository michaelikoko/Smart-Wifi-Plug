#include "pzem_task.h"
#include "config.h"
#include "mqtt.h"
#include "relay.h"
#include "mqtt_topics.h"
#include "pzem-driver.h"
#include "esp_log.h"
#include "cJSON.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdlib.h>
#include "esp_wifi.h"
#include "sntp.h"

static const char *TAG = "PZEM";


static int8_t get_rssi(void)
{
    /* Received Signal Strength Indicator */
    wifi_ap_record_t ap;
    if (esp_wifi_sta_get_ap_info(&ap) == ESP_OK) {
        return ap.rssi;
    }
    return 0;
}

static void publish_telemetry(void)
{
    bool ok = updateValues(PZEM_ADDR);
    if (!ok) {
        ESP_LOGE(TAG, "PZEM read failed — skipping publish");
        return;
    }

    cJSON *root = cJSON_CreateObject();
    if (!root) {
        ESP_LOGE(TAG, "Failed to create JSON object");
        return;
    }

    // device id omitted in this simulation build
    cJSON_AddNumberToObject(root, "v",     getVoltage());
    cJSON_AddNumberToObject(root, "i",     getCurrent());
    cJSON_AddNumberToObject(root, "p",     getPower());
    cJSON_AddNumberToObject(root, "e",     getEnergy());
    cJSON_AddNumberToObject(root, "f",     getFrequency());
    cJSON_AddNumberToObject(root, "pf",    getPF());
    cJSON_AddNumberToObject(root, "relay", relay_get_state() ? 1 : 0);
    cJSON_AddNumberToObject(root, "ts",    (double)sntp_get_epoch());
    cJSON_AddNumberToObject(root, "rssi",  get_rssi());

    char *payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (!payload) {
        ESP_LOGE(TAG, "Failed to serialise JSON");
        return;
    }

    esp_mqtt_client_publish(mqtt_client, mqtt_topic_pub_telemetry(),
                            payload, 0, 0, 0);
    ESP_LOGI(TAG, "Telemetry: %s", payload);
    free(payload);
}


/*
// Simulated telemetry values for testing without PZEM
static double sim_energy_wh = 0.0;

static void publish_telemetry(void)
{
    bool relay_on = relay_get_state();
    float voltage = 230.0f;
    float current = relay_on ? 0.478f : 0.0f;
    float power   = relay_on ? 80.0f : 0.0f;
    float freq    = 50.0f;
    float pf       = relay_on ? 0.95f : 0.0f;

    // accumulate energy only while relay is on, ~10s tick matches TELEMETRY_INTERVAL_MS
    if (relay_on) {
        sim_energy_wh += power * (TELEMETRY_INTERVAL_MS / 1000.0 / 3600.0);
    }

    cJSON *root = cJSON_CreateObject();
    cJSON_AddNumberToObject(root, "v", voltage);
    cJSON_AddNumberToObject(root, "i", current);
    cJSON_AddNumberToObject(root, "p", power);
    cJSON_AddNumberToObject(root, "e", sim_energy_wh);
    cJSON_AddNumberToObject(root, "f", freq);
    cJSON_AddNumberToObject(root, "pf", pf);
    cJSON_AddNumberToObject(root, "relay", relay_on ? 1 : 0);
    cJSON_AddNumberToObject(root, "ts", (double)sntp_get_epoch());
    cJSON_AddNumberToObject(root, "rssi", get_rssi());

    char *payload = cJSON_PrintUnformatted(root);
    if (!payload) { ESP_LOGE(TAG, "Failed to serialise JSON"); return; }

    esp_mqtt_client_publish(mqtt_client, mqtt_topic_pub_telemetry(), payload, 0, 0, 0);
    ESP_LOGI(TAG, "Telemetry (SIM): %s", payload);
    free(payload);
}
*/

void pzem_task(void *pvParameters)
{
    initialize_pzem(ESP_TX_TO_PZEM_RX_PIN, ESP_RX_FROM_PZEM_TX_PIN);
    ESP_LOGI(TAG, "PZEM initialized");

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(TELEMETRY_INTERVAL_MS));

        if (mqtt_client != NULL && mqtt_is_connected()) {
            publish_telemetry();
        } else {
            ESP_LOGW(TAG, "MQTT not ready — skipping telemetry");
        }
    }
}
