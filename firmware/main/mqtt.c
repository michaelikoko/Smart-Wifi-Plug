#include <string.h>
#include "mqtt.h"
#include "config.h"
#include "relay.h"
#include "esp_log.h"
#include "cJSON.h"
#include "sntp.h"
static const char *TAG = "MQTT";

esp_mqtt_client_handle_t mqtt_client = NULL;
bool is_mqtt_connected = false;

bool mqtt_is_connected(void)
{
    return is_mqtt_connected;
}

static void log_error_if_nonzero(const char *msg, int code)
{
    if (code != 0)
        ESP_LOGE(TAG, "%s: 0x%x", msg, code);
}

static void handle_relay_command(esp_mqtt_client_handle_t client,
                                 const char *data)
{
    cJSON *root = cJSON_Parse(data);
    if (!root)
    {
        ESP_LOGE(TAG, "Failed to parse relay command JSON");
        return;
    }

    cJSON *cmd = cJSON_GetObjectItem(root, "cmd");
    if (!cJSON_IsString(cmd))
    {
        ESP_LOGE(TAG, "Missing or invalid 'cmd' field");
        cJSON_Delete(root);
        return;
    }

    ESP_LOGI(TAG, "Relay command: %s", cmd->valuestring);

    if (strcmp(cmd->valuestring, "ON") == 0)
    {
        relay_set_and_publish(client, true, "app");
    }
    else if (strcmp(cmd->valuestring, "OFF") == 0)
    {
        relay_set_and_publish(client, false, "app");
    }
    else if (strcmp(cmd->valuestring, "TOGGLE") == 0)
    {
        relay_set_and_publish(client, !relay_get_state(), "app");
    }
    else
    {
        ESP_LOGW(TAG, "Unknown command: %s", cmd->valuestring);
    }

    cJSON_Delete(root);
}

static void mqtt_event_handler(void *args, esp_event_base_t base,
                               int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = event_data;
    esp_mqtt_client_handle_t client = event->client;
    int msg_id;

    switch (event->event_id)
    {

    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "Connected");
        is_mqtt_connected = true;

        // Publish online status
        // Build status payload with timestamp
        char status_payload[64];
        snprintf(status_payload, sizeof(status_payload),
                 "{\"status\":\"online\",\"ts\":%lld}", (long long)sntp_get_epoch());

        esp_mqtt_client_publish(client, MQTT_TOPIC_PUB_DEVICE_STATUS,
                                status_payload, 0, 1, 1);
        // esp_mqtt_client_publish(client, MQTT_TOPIC_PUB_DEVICE_STATUS, "{\"status\":\"online\"}", 0, 1, 1);

        // Subscribe to relay command topic
        msg_id = esp_mqtt_client_subscribe(client, MQTT_TOPIC_SUB_RELAY_CONTROL, 1);
        ESP_LOGI(TAG, "Subscribed to relay command, msg_id=%d", msg_id);

        // Publish initial relay state
        relay_set_and_publish(client, relay_get_state(), "boot");
        break;

    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "Disconnected");
        is_mqtt_connected = false;
        break;

    case MQTT_EVENT_DATA:
    {
        char topic[128] = {0};
        char data[256] = {0};
        snprintf(topic, sizeof(topic), "%.*s",
                 event->topic_len, event->topic);
        snprintf(data, sizeof(data), "%.*s",
                 event->data_len, event->data);

        ESP_LOGI(TAG, "Topic: %s | Data: %s", topic, data);

        if (strstr(topic, "/relay/command"))
        {
            handle_relay_command(client, data);
        }
        break;
    }

    case MQTT_EVENT_ERROR:
        if (event->error_handle->error_type ==
            MQTT_ERROR_TYPE_TCP_TRANSPORT)
        {
            log_error_if_nonzero("esp-tls",
                                 event->error_handle->esp_tls_last_esp_err);
            log_error_if_nonzero("tls stack",
                                 event->error_handle->esp_tls_stack_err);
            log_error_if_nonzero("socket errno",
                                 event->error_handle->esp_transport_sock_errno);
        }
        break;

    default:
        break;
    }
}

void mqtt_app_start(void)
{
    esp_mqtt_client_config_t cfg = {
        .broker.address.uri = MQTT_BROKER_URI,
        .session.last_will.topic = MQTT_TOPIC_PUB_DEVICE_STATUS,
        .session.last_will.msg = "{\"status\":\"offline\"}",
        .session.last_will.msg_len = 0,
        .session.last_will.qos = 1,
        .session.last_will.retain = true,
    };

    mqtt_client = esp_mqtt_client_init(&cfg);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID,
                                   mqtt_event_handler, NULL);
    esp_mqtt_client_start(mqtt_client);
}