#include "provisioning.h"

#include "config.h"
#include "device_id.h"
#include "wifi.h"
#include "wifi_creds.h"

#include "cJSON.h"
#include "esp_err.h"
#include "esp_event.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/task.h"
#include <ctype.h>
#include <stdbool.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

static const char *TAG = "PROVISION";
static httpd_handle_t provisioning_server = NULL;
static bool provisioning_started = false;
static esp_netif_t *provisioning_sta_netif = NULL;
static esp_netif_t *provisioning_ap_netif = NULL;

static esp_err_t wifi_post_handler(httpd_req_t *req)
{
    if (req->method != HTTP_POST) {
        httpd_resp_send_err(req, HTTPD_405_METHOD_NOT_ALLOWED, "POST only");
        return ESP_OK;
    }

    if (req->content_len <= 0) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Empty body");
        return ESP_OK;
    }

    char *body = calloc(1, (size_t)req->content_len + 1);
    if (body == NULL) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "No memory");
        return ESP_OK;
    }

    size_t received = 0;
    while (received < (size_t)req->content_len) {
        int remaining = (int)((size_t)req->content_len - received);
        int r = httpd_req_recv(req, body + received, remaining);
        if (r <= 0) {
            free(body);
            httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Failed to read body");
            return ESP_OK;
        }
        received += (size_t)r;
    }
    body[received] = '\0';

    cJSON *root = cJSON_ParseWithLength(body, received);
    free(body);
    if (root == NULL) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid JSON");
        return ESP_OK;
    }

    cJSON *ssid = cJSON_GetObjectItemCaseSensitive(root, "ssid");
    cJSON *password = cJSON_GetObjectItemCaseSensitive(root, "password");
    if (!cJSON_IsString(ssid) || !cJSON_IsString(password) ||
        ssid->valuestring == NULL || password->valuestring == NULL) {
        cJSON_Delete(root);
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "ssid/password required");
        return ESP_OK;
    }

    char ssid_buf[33];
    char pass_buf[65];
    snprintf(ssid_buf, sizeof(ssid_buf), "%s", ssid->valuestring);
    snprintf(pass_buf, sizeof(pass_buf), "%s", password->valuestring);
    cJSON_Delete(root);

    ESP_LOGI(TAG, "Provisioning WiFi for SSID: %s", ssid_buf);

    esp_wifi_disconnect();
    xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);

    wifi_config_t sta_cfg = {0};
    size_t ssid_copy_len = strnlen(ssid_buf, sizeof(sta_cfg.sta.ssid));
    memcpy(sta_cfg.sta.ssid, ssid_buf, ssid_copy_len);

    size_t pass_copy_len = strnlen(pass_buf, sizeof(sta_cfg.sta.password));
    memcpy(sta_cfg.sta.password, pass_buf, pass_copy_len);
    sta_cfg.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    wifi_suppress_auto_connect = true;

    esp_err_t err = esp_wifi_set_mode(WIFI_MODE_APSTA);
    if (err == ESP_OK) {
        err = esp_wifi_set_config(WIFI_IF_STA, &sta_cfg);
    }

    wifi_suppress_auto_connect = false;

    if (err == ESP_OK) {
        err = esp_wifi_connect();
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start WiFi connection: %s", esp_err_to_name(err));
        httpd_resp_set_type(req, "application/json");
        httpd_resp_sendstr(req, "{\"status\":\"failed\"}");
        return ESP_OK;
    }

    EventBits_t bits = xEventGroupWaitBits(
        wifi_event_group,
        WIFI_CONNECTED_BIT,
        pdFALSE,
        pdTRUE,
        pdMS_TO_TICKS(15000));

    httpd_resp_set_type(req, "application/json");

    if ((bits & WIFI_CONNECTED_BIT) != 0) {
        wifi_ap_record_t ap_info = {0};
        esp_err_t ap_err = esp_wifi_sta_get_ap_info(&ap_info);
        if (ap_err == ESP_OK && strcmp((const char *)ap_info.ssid, ssid_buf) == 0) {
            wifi_provisioning_mode_active = false;
            wifi_creds_save(ssid_buf, pass_buf);
            httpd_resp_sendstr(req, "{\"status\":\"connected\"}");
            vTaskDelay(pdMS_TO_TICKS(3000));
            esp_err_t mode_err = esp_wifi_set_mode(WIFI_MODE_STA);
            if (mode_err != ESP_OK) {
                ESP_LOGE(TAG, "Failed to drop AP mode: %s", esp_err_to_name(mode_err));
            }
            ESP_LOGI(TAG, "Provisioning complete; AP dropped");
        } else {
            httpd_resp_sendstr(req, "{\"status\":\"failed\"}");
            if (ap_err != ESP_OK) {
                ESP_LOGW(TAG, "Connected bit set but unable to read current AP info: %s", esp_err_to_name(ap_err));
            } else {
                ESP_LOGW(TAG, "Connected to unexpected SSID: %s (expected %s)",
                         (const char *)ap_info.ssid, ssid_buf);
            }
        }
    } else {
        httpd_resp_sendstr(req, "{\"status\":\"failed\"}");
        ESP_LOGW(TAG, "WiFi connection timed out");
    }

    return ESP_OK;
}

static const httpd_uri_t wifi_uri = {
    .uri = "/wifi",
    .method = HTTP_POST,
    .handler = wifi_post_handler,
    .user_ctx = NULL,
};

void provisioning_start(void)
{
    if (provisioning_started) {
        return;
    }
    provisioning_started = true;

    wifi_stack_init();
    wifi_provisioning_mode_active = true;

    if (wifi_event_group == NULL) {
        wifi_event_group = xEventGroupCreate();
    }

    provisioning_sta_netif = esp_netif_create_default_wifi_sta();
    provisioning_ap_netif = esp_netif_create_default_wifi_ap();

    wifi_country_t country = {
        .cc = "NG",
        .schan = 1,
        .nchan = 13,
        .policy = WIFI_COUNTRY_POLICY_MANUAL,
    };
    esp_wifi_set_country(&country);

    char ap_password[24];
    const char *device_id = device_id_get();
    char lower_suffix[7];
    size_t id_len = strlen(device_id);
    for (int i = 0; i < 6; i++) {
        lower_suffix[i] = (char)tolower((unsigned char)device_id[id_len - 6 + i]);
    }
    lower_suffix[6] = '\0';
    snprintf(ap_password, sizeof(ap_password), "password%s", lower_suffix);

    wifi_config_t ap_cfg = {
        .ap = {
            .ssid = {0},
            .ssid_len = 0,
            .channel = 1,
            .authmode = WIFI_AUTH_WPA2_PSK,
            .max_connection = 4,
            .beacon_interval = 100,
        },
    };

    const char *suffix = device_id + strlen(device_id) - 6;
    snprintf((char *)ap_cfg.ap.ssid, sizeof(ap_cfg.ap.ssid), "SmartPlug-%s", suffix);
    ap_cfg.ap.ssid_len = strlen((char *)ap_cfg.ap.ssid);
    snprintf((char *)ap_cfg.ap.password, sizeof(ap_cfg.ap.password), "%s", ap_password);

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    esp_err_t err = esp_wifi_set_max_tx_power(34);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "set_max_tx_power failed: %s", esp_err_to_name(err));
    }

    ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_NONE));

    if (provisioning_server == NULL) {
        httpd_config_t config = HTTPD_DEFAULT_CONFIG();
        config.server_port = 80;
        config.lru_purge_enable = true;

        ESP_ERROR_CHECK(httpd_start(&provisioning_server, &config));
        ESP_ERROR_CHECK(httpd_register_uri_handler(provisioning_server, &wifi_uri));
    }

    if (provisioning_ap_netif != NULL) {
        esp_netif_ip_info_t ip_info;
        if (esp_netif_get_ip_info(provisioning_ap_netif, &ip_info) == ESP_OK) {
            ESP_LOGI(TAG, "Provisioning AP ready at " IPSTR, IP2STR(&ip_info.ip));
        }
    }

    ESP_LOGI(TAG, "Provisioning AP SSID: %s", (char *)ap_cfg.ap.ssid);
    ESP_LOGI(TAG, "Provisioning AP password: %s", ap_password);
    if (provisioning_sta_netif != NULL) {
        ESP_LOGI(TAG, "Station netif ready for provisioning");
    }
}
