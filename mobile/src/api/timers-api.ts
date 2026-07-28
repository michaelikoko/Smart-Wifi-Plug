import apiClient from './client';
import type { DeviceResponse } from './devices-api';

export interface TimerResponse {
  id: number;
  device_id: string;
  name: string | null;
  time: string;
  action: 'ON' | 'OFF';
  is_enabled: boolean;
  last_triggered_date: string | null;
}

export interface TimerCreateRequest {
  name?: string;
  time: string;
  action: 'ON' | 'OFF';
  is_enabled?: boolean;
}

export interface TimerUpdateRequest {
  name?: string;
  time?: string;
  action?: 'ON' | 'OFF';
  is_enabled?: boolean;
}

export const listTimers = async (deviceId: string): Promise<TimerResponse[]> => {
  /* GET /devices/{device_id}/timers */
  const response = await apiClient.get<TimerResponse[]>(`/devices/${deviceId}/timers`);
  return response.data;
};

export const createTimer = async (
  deviceId: string,
  data: TimerCreateRequest
): Promise<TimerResponse> => {
  /* POST /devices/{device_id}/timers */
  const response = await apiClient.post<TimerResponse>(`/devices/${deviceId}/timers`, data);
  return response.data;
};

export const updateTimer = async (
  deviceId: string,
  timerId: number,
  data: TimerUpdateRequest
): Promise<TimerResponse> => {
  /* PATCH /devices/{device_id}/timers/{timer_id} */
  const response = await apiClient.patch<TimerResponse>(
    `/devices/${deviceId}/timers/${timerId}`,
    data
  );
  return response.data;
};

export const deleteTimer = async (deviceId: string, timerId: number): Promise<void> => {
  /* DELETE /devices/{device_id}/timers/{timer_id} */
  await apiClient.delete(`/devices/${deviceId}/timers/${timerId}`);
};

export const rearmTimerLock = async (deviceId: string): Promise<DeviceResponse> => {
  /*
   POST /devices/{device_id}/timers/rearm
   Clears device.timer_lock_reason/timer_locked_at only — does not
   touch cutoff_reason or any timer row. Returns the updated device.
  */
  const response = await apiClient.post<DeviceResponse>(`/devices/${deviceId}/timers/rearm`);
  return response.data;
};