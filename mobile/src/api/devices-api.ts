import apiClient from './client';

export interface DeviceResponse {
  id: number;
  device_id: string;
  user_id: number | null;
  name: string;
  is_enabled: boolean;
  is_online: boolean;
  relay_state: boolean;
  daily_limit_kwh: number | null;
  monthly_limit_kwh: number | null;
  auto_cutoff_enabled: boolean;
  cutoff_reason: string | null;
  cutoff_at: string | null;
  timer_lock_reason: string | null;
  timer_locked_at: string | null;
  last_seen: string | null;
  created_at: string;
}

export interface DeviceRegisterRequest {
  device_id: string;
  name: string;
}

export interface UpdateDeviceLimitsRequest {
  daily_limit_kwh?: number;
  monthly_limit_kwh?: number;
  auto_cutoff_enabled?: boolean;
}

export const listDevices = async (): Promise<DeviceResponse[]> => {
  /* 
  GET /devices/
  List all enabled devices belonging to the authenticated user.
  Call on login / app start, then pass device_ids to subscribeToDevices().
  */
  const response = await apiClient.get<DeviceResponse[]>('/devices/');
  return response.data;
};

export const getDevice = async (deviceId: string): Promise<DeviceResponse> => {
  /* GET /devices/{device_id} */
  const response = await apiClient.get<DeviceResponse>(`/devices/${deviceId}`);
  return response.data;
};

export const registerDevice = async (data: DeviceRegisterRequest): Promise<DeviceResponse> => {
  /* POST /devices/register */
  const response = await apiClient.post<DeviceResponse>('/devices/register', data);
  return response.data;
};

export const updateDevice = async (
    deviceId: string,
    data: { name: string }
): Promise<DeviceResponse> => {
  /* PATCH /devices/{device_id} — update name only */
  const response = await apiClient.patch<DeviceResponse>(`/devices/${deviceId}`, data);
  return response.data;
};

export const updateDeviceLimits = async (
  deviceId: string,
  data: UpdateDeviceLimitsRequest
): Promise<DeviceResponse> => {
  /* PATCH /devices/{device_id}/limits */
  const response = await apiClient.patch<DeviceResponse>(`/devices/${deviceId}/limits`, data);
  return response.data;
};


export const deleteDevice = async (deviceId: string): Promise<void> => {
  /*
   DELETE /devices/{device_id}
   Backend soft-deletes: is_enabled=false, user_id=null.
   Caller should also call unsubscribeFromDevice(deviceId) in onSuccess.  
  */
  await apiClient.delete(`/devices/${deviceId}`);
};
