import { create } from 'zustand';
import type { CurrentEnergyResponse, MonthlyEnergyResponse } from '../api/telemetry-api';

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
  receivedAt: number; 
}

export interface LiveRelayState {
  state: 'ON' | 'OFF';
  source: string;
  ts: number;
  receivedAt: number;
}

export interface LiveTimerLock {
  locked: boolean;
  reason: string | null;
  lockedAt: string | null;
}

interface DeviceStateEntry {
  telemetry: LiveTelemetry | null;
  relayState: LiveRelayState | null;
  timerLock: LiveTimerLock | null;
  isOnline: boolean | null; 
  currentEnergyReadings: CurrentEnergyResponse | null; 
  monthlyEnergyReadings: MonthlyEnergyResponse | null;  
  unreadEventCount: number;
}

interface DeviceStateStore {
  devices: Record<string, DeviceStateEntry>; 

  setTelemetry: (deviceId: string, data: LiveTelemetry) => void;
  setOnlineStatus: (deviceId: string, isOnline: boolean) => void;
  setCurrentEnergyReadings: (deviceId: string, data: CurrentEnergyResponse) => void;
  setMonthlyEnergyReadings: (deviceId: string, data: MonthlyEnergyResponse) => void;
  setRelayState: (deviceId: string, data: LiveRelayState) => void;
  setTimerLock: (deviceId: string, data: LiveTimerLock) => void;
  incrementUnreadEvents: (deviceId: string) => void;
  clearUnreadEvents: (deviceId: string) => void;
  totalUnreadEvents: () => number;
  clearDevice: (deviceId: string) => void;
  clearAll: () => void;
}

const DEFAULT_ENTRY: DeviceStateEntry = {
  telemetry: null,
  relayState: null,
  timerLock: null,
  isOnline: null,
  currentEnergyReadings: null,
  monthlyEnergyReadings: null, // Added property for monthly energy readings
  unreadEventCount: 0,
};

// 💡 Pass 'get' as the second argument to the creator function
export const useDeviceStateStore = create<DeviceStateStore>((set, get) => ({
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

  setCurrentEnergyReadings: (deviceId, data) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] ?? DEFAULT_ENTRY),
          currentEnergyReadings: data,
        },
      },
    })),

  setMonthlyEnergyReadings: (deviceId, data) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] ?? DEFAULT_ENTRY),
          monthlyEnergyReadings: data,
        },
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

  setTimerLock: (deviceId, data) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] ?? DEFAULT_ENTRY),
          timerLock: data,
        },
      },
    })),

  incrementUnreadEvents: (deviceId) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] ?? DEFAULT_ENTRY),
          unreadEventCount: (state.devices[deviceId]?.unreadEventCount ?? 0) + 1,
        },
      },
    })),

  clearUnreadEvents: (deviceId) =>
    set((state) => ({
      devices: {
        ...state.devices,
        [deviceId]: {
          ...(state.devices[deviceId] ?? DEFAULT_ENTRY),
          unreadEventCount: 0,
        },
      },
    })),

  // 💡 Explicit return type added, and using 'get()' instead of the store instance
  totalUnreadEvents: (): number => {
    const state = get();
    return Object.values(state.devices).reduce(
      (sum, entry) => sum + (entry.unreadEventCount ?? 0), 0
    );
  },

  clearDevice: (deviceId) =>
    set((state) => {
      const next = { ...state.devices };
      delete next[deviceId];
      return { devices: next };
    }),

  clearAll: () => set({ devices: {} }),
}));
