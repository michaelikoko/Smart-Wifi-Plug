import apiClient from './client';
import axios from 'axios';

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
    return axios.isAxiosError(error) && error.response?.status === 404;
}