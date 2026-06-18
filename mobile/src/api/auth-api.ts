import { type RegisterFormData } from '@/app/(auth)/register';
import { type LoginFormData } from '@/app/(auth)/login';
import apiClient from './client';
import { useAuthStore } from '../store/auth-store';

// API response types - They match the backend schema 
export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  billing_rate: number | null; // In kobo/kWh
  created_at: Date;
  updated_at: Date;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface VerifyResetOtpResponse {
  reset_token: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export const registerUser = async (data: RegisterFormData): Promise<UserResponse> => {
  const response = await apiClient.post<UserResponse>('/auth/register', {
    email: data.email,
    password: data.password,
    confirm_password: data.confirmPassword,
    full_name: data.name,
  });
  return response.data;
};


export const loginUser = async (data: LoginFormData): Promise<UserResponse> => {
  const tokenRes = await apiClient.post<TokenResponse>('/auth/login', {
    email: data.email,
    password: data.password,
  });

  const { access_token, refresh_token } = tokenRes.data;

  // Persist tokens before /me so the request interceptor attaches the header
  useAuthStore.getState().setTokens(access_token, refresh_token);

  const meRes = await apiClient.get<UserResponse>('/auth/me');
  useAuthStore.getState().setUser(meRes.data);

  return meRes.data;
};


export const logoutUser = async (): Promise<void> => {
  const refreshToken = useAuthStore.getState().refreshToken;

  if (refreshToken) {
    try {
      await apiClient.post('/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Ignore — server-side revocation is best-effort.
      // The token will expire naturally if we can't reach the server.
    }
  }

  useAuthStore.getState().logout();
};

export const getMe = async (): Promise<UserResponse> => {
  const response = await apiClient.get<UserResponse>('/auth/me');
  return response.data;
};

export const forgotPassword = async (data: { email: string }): Promise<ForgotPasswordResponse> => {
  /*
  POST /auth/forgot-password
  always resolves 200, even for unknown emails
  */
  const response = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', data);
  return response.data;
};

export const verifyResetOtp = async (data: {
  email: string;
  otp: string;
}): Promise<VerifyResetOtpResponse> => {
  /*
  POST /auth/verify-reset-otp 
  returns a short-lived reset token on success
  */
  const response = await apiClient.post<VerifyResetOtpResponse>('/auth/verify-reset-otp', data);
  return response.data;
};


export const resetPassword = async (data: {
  resetToken: string;
  new_password: string;
  confirm_password: string;
}): Promise<ResetPasswordResponse> => {
  /*
  POST /auth/reset-password
  IMPORTANT: this call must NOT use the normal session access token —
  it authenticates with the short-lived `reset_token` from
  verify-reset-otp instead. We pass a one-off Authorization header,
  overriding whatever the request interceptor would otherwise attach.

  We also set `_skipAuthRefresh` so a 401 here (expired reset session)
  does NOT trigger the access-token refresh flow in client.ts — it's a
  completely different token namespace.
  */
  const response = await apiClient.post<ResetPasswordResponse>(
    '/auth/reset-password',
    {
      new_password: data.new_password,
      confirm_password: data.confirm_password,
    },
    {
      headers: { Authorization: `Bearer ${data.resetToken}` },
      _skipAuthRefresh: true,
    }
  );
  return response.data;
};