#ifndef SNTP_H
#define SNTP_H

#include <stdbool.h>
#include <time.h>

void sntp_init_and_sync(void); // Starts SNTP and blocks until time is synced or timeout occurs
bool sntp_is_synced(void); // Returns true if time has been successfully synced since startup, false otherwise
time_t sntp_get_epoch(void); // Returns current epoch time in seconds. Note: will return system time even if not synced, which may be inaccurate until sync occurs.

#endif