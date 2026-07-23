#include "wifi.h"
#include "config.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"

static const char *TAG = "WiFi";
EventGroupHandle_t wifi_event_group;

static void wifi_event_handler(void *arg, esp_event_base_t base,
                               int32_t event_id, void *event_data)
{
    switch (event_id)
    {
    case WIFI_EVENT_STA_START:
        ESP_LOGI(TAG, "Connecting...");
        esp_wifi_connect();
        break;
    case WIFI_EVENT_STA_CONNECTED:
        ESP_LOGI(TAG, "Connected");
        break;
    case WIFI_EVENT_STA_DISCONNECTED:
    {
        wifi_event_sta_disconnected_t *disc = (wifi_event_sta_disconnected_t *)event_data;
        ESP_LOGW(TAG, "Disconnected — reason: %d — retrying...", disc->reason);
        xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);
        vTaskDelay(pdMS_TO_TICKS(1000)); // let the AP settle before retrying
        esp_wifi_connect();
        break;
    }
    case IP_EVENT_STA_GOT_IP:
    {
        ip_event_got_ip_t *e = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "IP: " IPSTR, IP2STR(&e->ip_info.ip));
        xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
        break;
    }
    default:
        break;
    }
}

void wifi_init_sta(void)
{
    wifi_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    wifi_country_t country = {
        .cc = "NG",
        .schan = 1,
        .nchan = 13,
        .policy = WIFI_COUNTRY_POLICY_MANUAL,
    };
    esp_wifi_set_country(&country);

    // esp_wifi_set_max_tx_power(34); // Set maximum transmit power to 8.5 dBm

    ESP_ERROR_CHECK(esp_event_handler_register(
        WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(
        IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event_handler, NULL));

    wifi_config_t wifi_cfg = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASSWORD,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK
            //.threshold.authmode = WIFI_AUTH_OPEN,
        }};
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    // Must be called AFTER esp_wifi_start()
    esp_err_t err = esp_wifi_set_max_tx_power(34); // 34 * 0.25dBm = 8.5dBm, matches WIFI_POWER_8_5dBm
    if (err != ESP_OK)
    {
        ESP_LOGW(TAG, "set_max_tx_power failed: %s", esp_err_to_name(err));
    }

    esp_wifi_set_ps(WIFI_PS_NONE);
}