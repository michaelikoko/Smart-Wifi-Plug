idf_component_register(SRCS "wifi_manager.c" "pzem_task.c" "main.c" "relay.c" "mqtt.c" "wifi.c" "sntp.c" "button.c" "device_id.c" "mqtt_topics.c" "wifi_creds.c" "provisioning.c"
                    INCLUDE_DIRS "."
                    REQUIRES lwip nvs_flash esp_wifi esp_event esp_netif esp_http_server pzem-drivers esp_driver_gpio)
