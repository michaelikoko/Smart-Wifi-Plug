#include "wokwi-api.h"
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

// Simulated values (adjustable via sliders)
// Voltage:      220.0V  -> 2200
// Current:      5.000A  -> 5000
// Power:        1100.0W -> 11000
// Energy:       100Wh   -> 100
// Frequency:    50.0Hz  -> 500
// PF:           1.00    -> 100

typedef struct
{
    uart_dev_t uart;
    uint8_t buf[16];
    uint8_t buf_len;
    uint32_t voltage_attr;
    uint32_t current_attr;
    uint32_t power_attr;
    uint32_t energy_attr;
    uint32_t frequency_attr;
    uint32_t pf_attr;
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

static void send_pzem_response(chip_state_t *chip, uint8_t slave_addr)
{
    uint8_t resp[25];

    // Read current slider values
    float voltage = attr_read_float(chip->voltage_attr);
    float current = attr_read_float(chip->current_attr);
    float power = attr_read_float(chip->power_attr);
    float energy = attr_read_float(chip->energy_attr);
    float frequency = attr_read_float(chip->frequency_attr);
    float pf = attr_read_float(chip->pf_attr);

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
    // Driver reads: resp[5]<<8 | resp[6] as LOW, resp[7]<<8 | resp[8] as HIGH
    resp[5] = (i_raw >> 8) & 0xFF;  // LOW reg MSB
    resp[6] = i_raw & 0xFF;         // LOW reg LSB
    resp[7] = (i_raw >> 24) & 0xFF; // HIGH reg MSB
    resp[8] = (i_raw >> 16) & 0xFF; // HIGH reg LSB

    // Power LOW (reg 0x0003) then HIGH (reg 0x0004)
    resp[9] = (p_raw >> 8) & 0xFF;
    resp[10] = p_raw & 0xFF;
    resp[11] = (p_raw >> 24) & 0xFF;
    resp[12] = (p_raw >> 16) & 0xFF;

    // Energy LOW (reg 0x0005) then HIGH (reg 0x0006)
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
    resp[23] = crc & 0xFF;        // CRC low byte
    resp[24] = (crc >> 8) & 0xFF; // CRC high byte

    uart_write(state.uart, resp, 25);

    printf("PZEM: Sent response to addr=0x%02X V=%.1f I=%.3f P=%.1f\n",
           slave_addr, voltage, current, power);
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
    state.energy_attr = attr_init_float("energy", 100.0f);
    state.frequency_attr = attr_init_float("frequency", 50.0f);
    state.pf_attr = attr_init_float("pf", 1.0f);

    uart_config_t cfg = {
        .tx = pin_init("TX", OUTPUT),
        .rx = pin_init("RX", INPUT),
        .baud_rate = 9600,
        .rx_data = on_uart_rx,
        .user_data = &state,
    };

    state.uart = uart_init(&cfg);
    printf("PZEM-004T chip initialized\n");
}