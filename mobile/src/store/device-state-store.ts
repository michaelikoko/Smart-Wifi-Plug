import { create } from 'zustand';

export interface LiveTelemetry {
  voltage: number;
  current: number;
  power: number;
  energy: number;
  frequency: number;
  pf: number;
  relay: boolean;
  rssi: number;
  ts: number;
  receivedAt: number; // Date.now() when this was processed client-side
}


export interface LiveRelayState {
  state: 'ON' | 'OFF';
  source: string;
  ts: number;
  receivedAt: number;
}

interface DeviceStateEntry {
  telemetry: LiveTelemetry | null;
  relayState: LiveRelayState | null;
  isOnline: boolean | null; // null = unknown, true = online, false = offline
}

interface DeviceStateStore {
  devices: Record<string, DeviceStateEntry>; // keyed by device_id

  setTelemetry: (deviceId: string, data: LiveTelemetry) => void;
  setOnlineStatus: (deviceId: string, isOnline: boolean) => void;
  setRelayState: (deviceId: string, data: LiveRelayState) => void;
  clearDevice: (deviceId: string) => void;
  clearAll: () => void;
}

const DEFAULT_ENTRY: DeviceStateEntry = {
  telemetry: null,
  relayState: null,
  isOnline: null,
};

export const useDeviceStateStore = create<DeviceStateStore>((set) => ({
  devices: {},

  setTelemetry: (deviceId, data) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] ?? DEFAULT_ENTRY),
          telemetry: data,
        },
      },
    })),

  setOnlineStatus: (deviceId, isOnline) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [deviceId]: { ...(state.devices[deviceId] ?? DEFAULT_ENTRY), isOnline },
      },
    })),

  setRelayState: (deviceId, data) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] ?? DEFAULT_ENTRY),
          relayState: data,
        },
      },
    })),

  clearDevice: (deviceId) =>
    set((state) => {
      const next = { ...state.devices };
      delete next[deviceId];
      return { devices: next };
    }),

  clearAll: () => set({ devices: {} }),
}));