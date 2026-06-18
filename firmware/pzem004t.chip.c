#include "wokwi-api.h"
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

// ── Simulated PZEM-004T ──────────────────────────────────────────────────────
//
// CHANGE FROM PREVIOUS VERSION:
//   `energy` used to be a static slider value that never moved — completely
//   unlike a real PZEM, where the energy register is a running total that
//   only ever increases (kWh meter behavior).
//
//   Now: energy accumulates in software, integrated from the `power` slider
//   over real elapsed time, using a repeating Wokwi timer. The `energy`
//   slider becomes a one-time STARTING OFFSET (read once at chip_init,
//   matching how a real meter that's been running for a while doesn't
//   start at zero) — after that, accumulated_energy_wh is what's reported.
//
//   accumulated_energy_wh += (power_W * pf) * (dt_seconds / 3600.0)
//
//   pf (power factor) is folded in because real energy delivered is
//   roughly apparent_power * pf, not just power. If you'd rather keep
//   this simpler, drop the `* pf` term — see ACCUMULATE_WITH_PF below.
//
// Sliders (adjustable in the Wokwi UI while running):
//   Voltage:      220.0V
//   Current:      5.000A
//   Power:        1100.0W   <- drives the accumulation rate
//   Energy:       100Wh     <- STARTING OFFSET ONLY, read once at boot
//   Frequency:    50.0Hz
//   PF:           1.00

#define ACCUMULATE_WITH_PF 1     // 1 = fold power factor into accumulation, 0 = power only
#define ACCUMULATION_INTERVAL_US 1000000UL  // 1 second tick — matches "Wh per second-ish" granularity

typedef struct
{
    uart_dev_t uart;
    uint8_t buf[16];
    uint8_t buf_len;

    uint32_t voltage_attr;
    uint32_t current_attr;
    uint32_t power_attr;
    uint32_t energy_attr;     // now used only as a one-time starting offset
    uint32_t frequency_attr;
    uint32_t pf_attr;

    timer_t energy_timer;
    double accumulated_energy_wh;  // the real, growing energy register
} chip_state_t;

static chip_state_t state;

static uint16_t modbus_crc16(const uint8_t *data, uint8_t len)
{
    uint16_t crc = 0xFFFF;
    for (uint8_t i = 0; i < len; i++)
    {
        crc ^= data[i];
        for (uint8_t j = 0; j < 8; j++)
        {
            if (crc & 0x0001)
                crc = (crc >> 1) ^ 0xA001;
            else
                crc >>= 1;
        }
    }
    return crc;
}

// ── Energy accumulation tick ──────────────────────────────────────────────────
//
// Called every ACCUMULATION_INTERVAL_US by the Wokwi timer, regardless of
// whether a Modbus read happens. This is what makes energy behave like a
// real running total instead of a snapshot taken only when polled — a real
// PZEM accumulates continuously, not just when someone asks it a question.

static void chip_energy_tick(void *user_data)
{
    chip_state_t *chip = (chip_state_t *)user_data;

    float power = attr_read_float(chip->power_attr);

#if ACCUMULATE_WITH_PF
    float pf = attr_read_float(chip->pf_attr);
    float effective_power = power * pf;
#else
    float effective_power = power;
#endif

    double dt_hours = (double)ACCUMULATION_INTERVAL_US / 1000000.0 / 3600.0;
    chip->accumulated_energy_wh += effective_power * dt_hours;

    // Energy can only ever increase (or hold steady at zero power) — never
    // goes negative, matching real meter behavior even if power somehow
    // reads negative due to a slider edge case.
    if (chip->accumulated_energy_wh < 0)
    {
        chip->accumulated_energy_wh = 0;
    }
}

static void send_pzem_response(chip_state_t *chip, uint8_t slave_addr)
{
    uint8_t resp[25];

    // Read current slider values for the "live" registers
    float voltage = attr_read_float(chip->voltage_attr);
    float current = attr_read_float(chip->current_attr);
    float power = attr_read_float(chip->power_attr);
    float frequency = attr_read_float(chip->frequency_attr);
    float pf = attr_read_float(chip->pf_attr);

    // Energy now comes from the accumulator, NOT a static slider read.
    float energy = (float)chip->accumulated_energy_wh;

    // Convert to raw register values per datasheet resolution
    uint32_t v_raw = (uint32_t)(voltage * 10);   // 0.1V per LSB
    uint32_t i_raw = (uint32_t)(current * 1000); // 0.001A per LSB
    uint32_t p_raw = (uint32_t)(power * 10);     // 0.1W per LSB
    uint32_t e_raw = (uint32_t)(energy);         // 1Wh per LSB
    uint32_t f_raw = (uint32_t)(frequency * 10); // 0.1Hz per LSB
    uint32_t pf_raw = (uint32_t)(pf * 100);      // 0.01 per LSB

    resp[0] = slave_addr;
    resp[1] = 0x04; // Function code: Read Input Registers
    resp[2] = 0x14; // 20 bytes of data (10 registers x 2 bytes)

    // Voltage (reg 0x0000) - 1 register
    resp[3] = (v_raw >> 8) & 0xFF;
    resp[4] = v_raw & 0xFF;

    // Current LOW (reg 0x0001) then HIGH (reg 0x0002)
    resp[5] = (i_raw >> 8) & 0xFF;
    resp[6] = i_raw & 0xFF;
    resp[7] = (i_raw >> 24) & 0xFF;
    resp[8] = (i_raw >> 16) & 0xFF;

    // Power LOW (reg 0x0003) then HIGH (reg 0x0004)
    resp[9] = (p_raw >> 8) & 0xFF;
    resp[10] = p_raw & 0xFF;
    resp[11] = (p_raw >> 24) & 0xFF;
    resp[12] = (p_raw >> 16) & 0xFF;

    // Energy LOW (reg 0x0005) then HIGH (reg 0x0006) — now the accumulated value
    resp[13] = (e_raw >> 8) & 0xFF;
    resp[14] = e_raw & 0xFF;
    resp[15] = (e_raw >> 24) & 0xFF;
    resp[16] = (e_raw >> 16) & 0xFF;

    // Frequency (reg 0x0007)
    resp[17] = (f_raw >> 8) & 0xFF;
    resp[18] = f_raw & 0xFF;

    // Power Factor (reg 0x0008)
    resp[19] = (pf_raw >> 8) & 0xFF;
    resp[20] = pf_raw & 0xFF;

    // Alarm status (reg 0x0009) - 0 = no alarm
    resp[21] = 0x00;
    resp[22] = 0x00;

    // CRC over first 23 bytes
    uint16_t crc = modbus_crc16(resp, 23);
    resp[23] = crc & 0xFF;
    resp[24] = (crc >> 8) & 0xFF;

    uart_write(state.uart, resp, 25);

    printf("PZEM: Sent response to addr=0x%02X V=%.1f I=%.3f P=%.1f E=%.2fWh\n",
           slave_addr, voltage, current, power, energy);
}

static void on_uart_rx(void *user_data, uint8_t byte)
{
    chip_state_t *chip = (chip_state_t *)user_data;

    if (chip->buf_len < sizeof(chip->buf))
    {
        chip->buf[chip->buf_len++] = byte;
    }

    // Modbus request is exactly 8 bytes
    if (chip->buf_len >= 8)
    {
        uint8_t slave_addr = chip->buf[0];
        uint8_t func_code = chip->buf[1];
        uint16_t start_reg = ((uint16_t)chip->buf[2] << 8) | chip->buf[3];
        uint16_t num_regs = ((uint16_t)chip->buf[4] << 8) | chip->buf[5];

        // Verify CRC
        uint16_t recv_crc = ((uint16_t)chip->buf[7] << 8) | chip->buf[6];
        uint16_t calc_crc = modbus_crc16(chip->buf, 6);

        printf("PZEM: Request addr=0x%02X func=0x%02X reg=0x%04X num=%d CRC_ok=%d\n",
               slave_addr, func_code, start_reg, num_regs, recv_crc == calc_crc);

        if (calc_crc == recv_crc && func_code == 0x04 && start_reg == 0x0000)
        {
            send_pzem_response(chip, slave_addr);
        }

        chip->buf_len = 0;
    }
}

void chip_init(void)
{
    state.buf_len = 0;

    // Initialize sliders with realistic defaults
    state.voltage_attr = attr_init_float("voltage", 220.0f);
    state.current_attr = attr_init_float("current", 5.0f);
    state.power_attr = attr_init_float("power", 1100.0f);
    state.energy_attr = attr_init_float("energy", 100.0f);  // starting offset only
    state.frequency_attr = attr_init_float("frequency", 50.0f);
    state.pf_attr = attr_init_float("pf", 1.0f);

    // Seed the accumulator from the "energy" slider's value once, at boot —
    // this is the one and only time energy_attr is read. From here on,
    // accumulated_energy_wh is the source of truth and only grows.
    state.accumulated_energy_wh = (double)attr_read_float(state.energy_attr);

    uart_config_t cfg = {
        .tx = pin_init("TX", OUTPUT),
        .rx = pin_init("RX", INPUT),
        .baud_rate = 9600,
        .rx_data = on_uart_rx,
        .user_data = &state,
    };
    state.uart = uart_init(&cfg);

    // Repeating timer drives continuous energy accumulation, independent
    // of whether the ESP32 is actively polling via Modbus.
    const timer_config_t energy_timer_cfg = {
        .callback = chip_energy_tick,
        .user_data = &state,
    };
    state.energy_timer = timer_init(&energy_timer_cfg);
    timer_start(state.energy_timer, ACCUMULATION_INTERVAL_US, true);

    printf("PZEM-004T chip initialized — starting energy=%.2fWh, accumulating every %lus\n",
           state.accumulated_energy_wh, ACCUMULATION_INTERVAL_US / 1000000UL);
}