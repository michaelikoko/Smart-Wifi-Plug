#include "button.h"
#include "config.h"
#include "relay.h"
#include "mqtt.h"
#include "esp_log.h"
#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "BUTTON";

// Button states for press classification
typedef enum {
    PRESS_NONE,
    PRESS_SHORT,   // < 3s  → toggle relay
    PRESS_LONG,    // >= 3s → reserved for factory reset later
} press_type_t;

static void button_gpio_init(void)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << BUTTON_PIN),
        .mode         = GPIO_MODE_INPUT,
        .pull_up_en   = GPIO_PULLUP_ENABLE,   // internal pull-up
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type    = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);
}

static press_type_t wait_for_press(void)
{
    // Wait for button press (active LOW — pulled high, goes low when pressed)
    while (gpio_get_level(BUTTON_PIN) == 1) {
        vTaskDelay(pdMS_TO_TICKS(10));
    }

    // Button is now pressed — start timing
    uint32_t held_ms = 0;

    while (gpio_get_level(BUTTON_PIN) == 0) {
        vTaskDelay(pdMS_TO_TICKS(10));
        held_ms += 10;

        // Cap measurement to avoid waiting forever
        if (held_ms >= 10000) break;
    }

    // Debounce — ignore presses shorter than 50ms (noise)
    if (held_ms < 50) {
        return PRESS_NONE;
    }

    if (held_ms >= 3000) {
        return PRESS_LONG;
    }

    return PRESS_SHORT;
}

void button_task(void *pvParameters)
{
    button_gpio_init();
    ESP_LOGI(TAG, "Button task started on GPIO %d", BUTTON_PIN);

    while (1) {
        press_type_t press = wait_for_press();

        switch (press) {

        case PRESS_SHORT:
            ESP_LOGI(TAG, "Short press — toggling relay");
            if (mqtt_client != NULL && is_mqtt_connected) {
                relay_set_and_publish(mqtt_client, !relay_get_state(), "button");
            } else {
                // WiFi/MQTT down — still toggle relay and save to NVS
                // but cannot publish state to broker
                bool new_state = !relay_get_state();
                gpio_set_level(RELAY_PIN, new_state ? 1 : 0);
                relay_save_state(new_state);
                ESP_LOGW(TAG, "MQTT offline — relay toggled locally only");
            }
            break;

        case PRESS_LONG:
            // Placeholder for factory reset in a later stage
            ESP_LOGW(TAG, "Long press detected — factory reset not yet implemented");
            break;

        case PRESS_NONE:
            // Noise / bounce — ignore
            break;
        }

        // Small delay after handling a press before watching for the next one
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}