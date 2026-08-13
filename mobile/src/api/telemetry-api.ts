import { isAxiosError } from 'axios';
import apiClient from './client';

export interface CurrentEnergyResponse {
    device_id: string;
    date: string;
    energy_first: number;
    energy_first_timestamp: string;
    energy_last: number;
    energy_last_timestamp: string;
    kwh_consumed: number;
    peak_power: number;
    peak_power_timestamp: string;
    updated_at: string;
    created_at: string;
    estimated_cost: number | null; // In kobo, null if billing_rate is not set for the device
}

export interface MonthlyEnergyResponse {
    device_id: string;
    month: string;
    kwh_consumed: number;
    estimated_cost: number | null; // In kobo, null if billing_rate is not set for the device
}

export interface EnergyConsumedResponse {
    device_id: string;
    date: string;
    kwh_consumed: number;
    peak_power: number;
    estimated_cost: number | null; // In kobo, null if billing_rate is not set for the device
}

export interface TelemetryReadingResponse {
    id: number;
    device_id: string;
    timestamp: string;
    received_at: string;
    voltage: number;
    current: number;
    power: number;
    energy: number;
    frequency: number;
    pf: number;
    relay: boolean;
    rssi: number;
}

export interface TelemetryListResponse {
    device_id: string;
    count: number;
    readings: TelemetryReadingResponse[];
}


export const getTodayEnergy = async (deviceId: string): Promise<CurrentEnergyResponse> => {
    /*
    GET /telemetry/{device_id}/energy/today
    Returns today's running kWh + peak power from DeviceDailySummary.
    404 if the device hasn't reported today.  
    */
    const response = await apiClient.get<CurrentEnergyResponse>(
        `/telemetry/${deviceId}/energy/today`
    );
    return response.data;
};

export const getMonthlyEnergy = async (deviceId: string): Promise<MonthlyEnergyResponse> => {
    /*
    GET /telemetry/{device_id}/energy/monthly
    Returns the sum of kwh_consumed for the current calendar month.
    404 if no data exists for this device this month.
    */
    const response = await apiClient.get<MonthlyEnergyResponse>(
        `/telemetry/${deviceId}/energy/monthly`
    );
    return response.data;
};


export const getEnergyHistory = async (
    deviceId: string,
    days = 7
): Promise<EnergyConsumedResponse[]> => {
    /*
    GET /telemetry/{device_id}/energy/history?days=7
    Returns one EnergyConsumedResponse per day, DESC order (newest first).
    Caller reverses for left-to-right bar chart display.
    404 if no history exists for this device.    
    */
    const response = await apiClient.get<EnergyConsumedResponse[]>(
        `/telemetry/${deviceId}/energy/history`,
        { params: { days } }
    );
    return response.data;
};


export const getTelemetryHistory = async (
    deviceId: string,
    limit = 100,
    offset = 0
): Promise<TelemetryListResponse> => {
    /*
    GET /telemetry/{device_id}?limit=100&offset=0
    Raw reading history — for the Analytics tab detail view later.
    Not used on the home dashboard.
    */
    const response = await apiClient.get<TelemetryListResponse>(`/telemetry/${deviceId}`, {
        params: { limit, offset },
    });
    return response.data;
};


export function is404(error: unknown): boolean {
    /*
    Helper used by useQuery's retry option to suppress retries on 404.
    404 = "no data yet", which is a normal state, not an error worth retrying.    
    */
    return isAxiosError(error) && error.response?.status === 404;
}


export const getEnergyHistorySafe = async (
    deviceId: string,
    days = 7
): Promise<EnergyConsumedResponse[]> => {
    /*
    Same as getEnergyHistory, but returns [] instead of throwing on a 404
    ("no history yet" is a normal state for a freshly-registered device,
    not an error worth surfacing per-device in a fleet-wide screen).
    Other errors (network, 5xx) still throw.
    */
    try {
        return await getEnergyHistory(deviceId, days);
    } catch (error) {
        if (is404(error)) return [];
        throw error;
    }
};

export const getEnergyHistoryRange = async (
    deviceId: string,
    startDate: string, // "YYYY-MM-DD"
    endDate: string,   // "YYYY-MM-DD"
): Promise<EnergyConsumedResponse[]> => {
    /*
    GET /telemetry/{device_id}/energy/history?start_date=...&end_date=...
    Returns one EnergyConsumedResponse per day within the inclusive range,
    DESC order (newest first). 404 if no rows exist in that range.
    */
    const response = await apiClient.get<EnergyConsumedResponse[]>(
        `/telemetry/${deviceId}/energy/history`,
        { params: { start_date: startDate, end_date: endDate } }
    );
    return response.data;
};

export const getEnergyHistoryRangeSafe = async (
    deviceId: string,
    startDate: string,
    endDate: string,
): Promise<EnergyConsumedResponse[]> => {
    /*
    Same as getEnergyHistoryRange, but returns [] instead of throwing on a 404
    — an empty month (e.g. before the device was registered) is a normal
    state for the month picker, not an error.
    */
    try {
        return await getEnergyHistoryRange(deviceId, startDate, endDate);
    } catch (error) {
        if (is404(error)) return [];
        throw error;
    }
};