import apiClient from './client';
import { type UserResponse } from './auth-api';

export interface UpdateBillingRateRequest {
  billing_rate: number; // cost per kWh in kobo (smallest currency unit), must be >= 1
}

export const updateBillingRate = async (
  data: UpdateBillingRateRequest
): Promise<UserResponse> => {
  /*
   PATCH /users/me/billing
   Updates the authenticated user's global billing_rate.
   Backend returns the full updated UserResponse (including devices) —
   callers should sync this directly into auth-store via setUser().
  */
  const response = await apiClient.patch<UserResponse>('/users/me/billing', data);
  return response.data;
};

export interface UpdateProfileRequest {
  full_name: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export const updateProfile = async (
  data: UpdateProfileRequest
): Promise<UserResponse> => {
  /* PATCH /users/me — updates full_name only, returns full UserResponse */
  const response = await apiClient.patch<UserResponse>('/users/me', data);
  return response.data;
};

export const changePassword = async (
  data: ChangePasswordRequest
): Promise<ChangePasswordResponse> => {
  /*
   POST /users/me/change-password
   On success, the backend revokes ALL refresh tokens for this user.
   Callers must treat success as a forced logout: clear the local
   auth-store directly (do NOT call logoutUser(), since the refresh
   token is already revoked server-side) and redirect to login.
  */
  const response = await apiClient.post<ChangePasswordResponse>(
    '/users/me/change-password',
    data
  );
  return response.data;
};