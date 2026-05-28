idf_component_register(SRCS "pzem_task.c" "main.c" "relay.c" "mqtt.c" "wifi.c" "sntp.c" "button.c"
                    INCLUDE_DIRS "." REQUIRES lwip nvs_flash esp_wifi pzem-drivers esp_driver_gpio)
