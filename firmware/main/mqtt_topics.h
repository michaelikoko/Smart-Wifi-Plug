#ifndef MQTT_TOPICS_H
#define MQTT_TOPICS_H

void mqtt_topics_init(void);

const char *mqtt_topic_pub_device_status(void);
const char *mqtt_topic_pub_relay_state(void);
const char *mqtt_topic_pub_telemetry(void);
const char *mqtt_topic_sub_relay_control(void);

#endif
