import apiClient from './client';
import type { UserResponse } from './auth-api';

export interface UpdateBillingRateRequest {
    billing_rate: number; // cost per kWh in kobo, must be >= 1
}

export const updateBillingRate = async (
    data: UpdateBillingRateRequest
): Promise<UserResponse> => {
    /*
    PATCH /users/me/billing
    Updates the billing rate for the authenticated user. The billing rate is specified in kobo per kWh and must be a positive integer (>= 1).     
    */
    const response = await apiClient.patch<UserResponse>('/users/me/billing', data);
    return response.data;
};