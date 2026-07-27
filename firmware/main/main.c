#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "nvs_flash.h"
#include "esp_log.h"

#include "config.h"
#include "wifi.h"
#include "mqtt.h"
#include "relay.h"
#include "pzem_task.h"
#include "sntp.h"
#include "button.h"
#include "device_id.h"
#include "mqtt_topics.h"
#include "wifi_creds.h"
#include "wifi_manager.h"
#include "provisioning.h"

static const char *TAG = "MAIN";

static void start_normal_services(void)
{
    static bool services_started = false;

    if (services_started) {
        return;
    }
    services_started = true;

    mqtt_topics_init();

    // Sync time before MQTT starts so first telemetry has valid timestamp
    sntp_init_and_sync();

    // Small delay for network stack to settle
    vTaskDelay(pdMS_TO_TICKS(1000));

    // MQTT
    mqtt_app_start();

    wifi_manager_init();

    // Tasks
    xTaskCreatePinnedToCore(pzem_task, "pzem_task", 4096, NULL, PRIORITY_PZEM, NULL, 0);
    xTaskCreatePinnedToCore(button_task, "button_task", 2048, NULL, PRIORITY_BUTTON, NULL, 0);
    ESP_LOGI(TAG, "All tasks started");
}

void app_main(void)
{
    // NVS init
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES ||
        ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    device_id_init();

    // Hardware init
    relay_init();

    char wifi_ssid[33] = {0};
    char wifi_pass[65] = {0};

    if (wifi_creds_load(wifi_ssid, sizeof(wifi_ssid), wifi_pass, sizeof(wifi_pass))) {
        wifi_init_sta(wifi_ssid, wifi_pass);
    } else {
        ESP_LOGI(TAG, "No stored WiFi credentials; starting provisioning");
        provisioning_start();
    }

    // WiFi — block until IP obtained
    xEventGroupWaitBits(wifi_event_group, WIFI_CONNECTED_BIT,
                        pdFALSE, pdTRUE, portMAX_DELAY);
    ESP_LOGI(TAG, "WiFi ready");
    start_normal_services();
}
