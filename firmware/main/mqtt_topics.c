#include "mqtt_topics.h"

#include "device_id.h"
#include <stdbool.h>
#include <stdio.h>

static char topic_pub_device_status[96];
static char topic_pub_relay_state[96];
static char topic_pub_telemetry[96];
static char topic_sub_relay_control[96];
static char topic_sub_wifi_control[96];
static char topic_pub_wifi_result[96];
static bool mqtt_topics_ready = false;

void mqtt_topics_init(void)
{
    if (mqtt_topics_ready) {
        return;
    }

    const char *device_id = device_id_get();

    snprintf(topic_pub_device_status, sizeof(topic_pub_device_status),
             "smartplug/%s/status", device_id);
    snprintf(topic_pub_relay_state, sizeof(topic_pub_relay_state),
             "smartplug/%s/relay/state", device_id);
    snprintf(topic_pub_telemetry, sizeof(topic_pub_telemetry),
             "smartplug/%s/telemetry", device_id);
    snprintf(topic_sub_relay_control, sizeof(topic_sub_relay_control),
             "smartplug/%s/relay/command", device_id);
    snprintf(topic_sub_wifi_control, sizeof(topic_sub_wifi_control),
             "smartplug/%s/wifi/command", device_id);
    snprintf(topic_pub_wifi_result, sizeof(topic_pub_wifi_result),
             "smartplug/%s/wifi/result", device_id);

    mqtt_topics_ready = true;
}

const char *mqtt_topic_pub_device_status(void)
{
    mqtt_topics_init();
    return topic_pub_device_status;
}

const char *mqtt_topic_pub_relay_state(void)
{
    mqtt_topics_init();
    return topic_pub_relay_state;
}

const char *mqtt_topic_pub_telemetry(void)
{
    mqtt_topics_init();
    return topic_pub_telemetry;
}

const char *mqtt_topic_sub_relay_control(void)
{
    mqtt_topics_init();
    return topic_sub_relay_control;
}

const char *mqtt_topic_sub_wifi_control(void)
{
    mqtt_topics_init();
    return topic_sub_wifi_control;
}

const char *mqtt_topic_pub_wifi_result(void)
{
    mqtt_topics_init();
    return topic_pub_wifi_result;
}
