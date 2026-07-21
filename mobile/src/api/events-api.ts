import apiClient from './client';

export interface EnergyEventResponse {
  id: number;
  device_id: string;
  user_id: number;
  event_type: string;
  period: string;
  period_key: string;
  kwh_at_event: number;
  limit_kwh: number;
  is_read: boolean;
  created_at: string | null;
}

export interface EventListResponse {
  total: number;
  limit: number;
  offset: number;
  events: EnergyEventResponse[];
}

export interface ListEventsParams {
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}

export const listEvents = async (
  params?: ListEventsParams
): Promise<EventListResponse> => {
  const response = await apiClient.get<EventListResponse>('/events', { params });
  return response.data;
};

export const markEventRead = async (eventId: number): Promise<EnergyEventResponse> => {
  const response = await apiClient.patch<EnergyEventResponse>(`/events/${eventId}/read`);
  return response.data;
};

export const markAllEventsRead = async (): Promise<{ marked_read: number }> => {
  const response = await apiClient.patch<{ marked_read: number }>('/events/read-all');
  return response.data;
};
