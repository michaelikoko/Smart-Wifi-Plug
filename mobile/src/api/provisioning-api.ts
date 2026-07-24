import { create as axiosCreate } from 'axios';

type ProvisioningStatus = 'connected' | 'failed' | 'ambiguous';

export type SubmitWifiCredentialsResponse = {
  status: ProvisioningStatus;
};

const provisioningClient = axiosCreate({
  baseURL: 'http://192.168.163.30',
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

function isProvisioningStatus(value: unknown): value is ProvisioningStatus {
  return value === 'connected' || value === 'failed' || value === 'ambiguous';
}

export async function submitWifiCredentials(
  ssid: string,
  password: string
): Promise<SubmitWifiCredentialsResponse> {
  try {
    const response = await provisioningClient.post<{ status?: unknown }>('/wifi', {
      ssid,
      password,
    });

    const status = response.data?.status;

    if (isProvisioningStatus(status)) {
      return { status };
    }

    return { status: 'ambiguous' };
  } catch {
    // The device may intentionally drop its SoftAP while sending the reply.
    // In that case, a transport error is expected and should not be treated
    // as a hard provisioning failure.
    return { status: 'ambiguous' };
  }
}
