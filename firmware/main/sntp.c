#include "sntp.h"
#include "esp_log.h"
#include "esp_sntp.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <time.h>
#include <sys/time.h>

static const char *TAG = "SNTP";
static volatile bool time_synced = false;

static void sntp_sync_callback(struct timeval *tv)
{
    time_synced = true;
    time_t now = tv->tv_sec;
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);
    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
    ESP_LOGI(TAG, "Time synced: %s (Lagos)", buf);
}

void sntp_init_and_sync(void)
{
    ESP_LOGI(TAG, "Initialising SNTP...");

    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_setservername(1, "time.google.com");

    // Set timezone to West Africa Time (Lagos, UTC+1, no DST)
    setenv("TZ", "WAT-1", 1);
    tzset();

    sntp_set_time_sync_notification_cb(sntp_sync_callback);
    esp_sntp_init();

    // Wait for sync — max 10 seconds
    int retries = 0;
    while (!time_synced && retries < 20) {
        ESP_LOGI(TAG, "Waiting for time sync... (%d/20)", retries + 1);
        vTaskDelay(pdMS_TO_TICKS(500));
        retries++;
    }

    if (!time_synced) {
        ESP_LOGW(TAG, "Time sync timed out — timestamps will be invalid until sync");
    }
}

bool sntp_is_synced(void)
{
    return time_synced;
}

time_t sntp_get_epoch(void)
{
    return time(NULL);
}