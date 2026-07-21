import mqtt, { MqttClient } from 'mqtt';
import { queryClient } from './query-client';
import { useDeviceStateStore } from '../store/device-state-store';
import type { LiveTelemetry, LiveRelayState } from '../store/device-state-store';
import type { CurrentEnergyResponse, MonthlyEnergyResponse } from '../api/telemetry-api';

let client: MqttClient | null = null;
let connectPromise: Promise<MqttClient> | null = null;

const subscribedDeviceIds = new Set<string>();


function getClient(): Promise<MqttClient> {
  if (client?.connected) return Promise.resolve(client);
  if (connectPromise) return connectPromise;

  connectPromise = new Promise((resolve, reject) => {
//    const c = mqtt.connect(MQTT_WS_URL, {
    const c = mqtt.connect({
      protocol: 'ws',
      hostname: 'broker.hivemq.com',
      port: 8000,
      clientId: `smartplug-${Math.random().toString(16).slice(2, 10)}`,
      path: '/mqtt',
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 10000, // Slightly increased for public brokers
    });

    c.on('connect', () => {
      console.log('[mqtt] connected');
      client = c;
      connectPromise = null;

      if (subscribedDeviceIds.size > 0) {
        _subscribeTopicsForDevices([...subscribedDeviceIds], c);
      }

      resolve(c);
    });

    c.on('message', _handleMessage);

    c.on('error', (err) => {
      console.error('[mqtt] connection error:', err.message);
      // DO NOT reject here. If it hasn't connected yet, the timeout will handle it.
      // If it's already running, MQTT.js will auto-reconnect.
    });

    // Handle initial connection timeout manually to clean up the promise
    const timeoutHandle = setTimeout(() => {
      if (!c.connected) {
        console.warn('[mqtt] connection attempt timed out.');
        connectPromise = null;
        c.end(true); // Force close the stalled socket
        reject(new Error('MQTT connection timeout'));
      }
    }, 10000);

    c.on('connect', () => {
      clearTimeout(timeoutHandle);
    });

    c.on('close', () => {
      console.warn('[mqtt] connection closed');
      if (client === c) client = null;
    });

    c.on('reconnect', () => {
      console.log('[mqtt] reconnecting...');
    });
  });

  return connectPromise;
}


function _handleMessage(topic: string, payloadBuffer: Buffer) {
  const { setTelemetry, setRelayState } = useDeviceStateStore.getState();

  // Parse topic: smartplug/<device_id>/<subtopic>
  const parts = topic.split('/');
  if (parts.length < 3 || parts[0] !== 'smartplug') return;

  const deviceId = parts[1];
  const subtopic = parts.slice(2).join('/');

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payloadBuffer.toString('utf-8'));
  } catch {
    console.warn('[mqtt] unparseable message on', topic);
    return;
  }

  if (subtopic === 'telemetry') {
    // Firmware payload: { v, i, p, e, f, pf, relay(0|1), ts, rssi }
    const telemetry: LiveTelemetry = {
      voltage:   data.v as number,
      current:   data.i as number,
      power:     data.p as number,
      energy:    data.e as number,
      frequency: data.f as number,
      pf:        data.pf as number,
      relay:     (data.relay as number) === 1,
      rssi:      data.rssi as number,
      ts:        data.ts as number,
      receivedAt: Date.now(),
    };
    setTelemetry(deviceId, telemetry);
    return;
  }

  if (subtopic === 'relay/state') {
    // Firmware payload: { state: "ON"|"OFF", source: "app"|"button"|"boot", ts }
    const relayState: LiveRelayState = {
      state:     data.state as 'ON' | 'OFF',
      source:    data.source as string,
      ts:        data.ts as number,
      receivedAt: Date.now(),
    };
    setRelayState(deviceId, relayState);
    return;
  }

  if (subtopic === 'be-online-status') {
    // Backend payload: { isOnline: true|false }
    console.log(`[mqtt] be-online-status ${deviceId} online status:`, data);
    useDeviceStateStore.getState().setOnlineStatus(deviceId, Boolean(data.is_online));
    return;
  }

  if (subtopic === 'be-daily-summary') {
    // Backend payload: CurrentEnergyResponse
    console.log(`[mqtt] be-daily-summary ${deviceId} data:`, data);
    useDeviceStateStore.getState().setCurrentEnergyReadings(deviceId, data as any as CurrentEnergyResponse);
    return;
  }

  if (subtopic === "be-monthly-summary") {
    // Backend payload: MonthlyEnergyResponse
    console.log(`[mqtt] be-monthly-summary ${deviceId} data:`, data);
    useDeviceStateStore.getState().setMonthlyEnergyReadings(deviceId, data as any as MonthlyEnergyResponse);
    return;
  }

  if (subtopic === 'energy-event') {
    console.log(`[mqtt] energy-event ${deviceId}:`, data);
    useDeviceStateStore.getState().incrementUnreadEvents(deviceId);
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['devices'] }); // ← add this
    return;
  }
}


function _subscribeTopicsForDevices(deviceIds: string[], c: MqttClient) {
  const topics = deviceIds.flatMap((id) => [
    `smartplug/${id}/telemetry`,
    `smartplug/${id}/relay/state`,
    `smartplug/${id}/be-online-status`, // Endpoint that only the server publishes to indicate online/offline status 
    `smartplug/${id}/be-daily-summary`, // Endpoint that only the server publishes to indicate daily energy summary
    `smartplug/${id}/be-monthly-summary`, // Endpoint that only the server publishes to indicate monthly energy summary
    `smartplug/${id}/energy-event`,
  ]);

  c.subscribe(topics, { qos: 1 }, (err) => {
    if (err) {
      console.error('[mqtt] subscribe error:', err.message);
    } else {
      console.log('[mqtt] subscribed for devices:', deviceIds);
    }
  });
}

export async function subscribeToDevices(deviceIds: string[]): Promise<void> {
  const newIds = deviceIds.filter((id) => !subscribedDeviceIds.has(id));
  if (newIds.length === 0) return;

  const c = await getClient();
  _subscribeTopicsForDevices(newIds, c);
  newIds.forEach((id) => subscribedDeviceIds.add(id));
}

export async function unsubscribeFromDevice(deviceId: string): Promise<void> {
  subscribedDeviceIds.delete(deviceId);
  useDeviceStateStore.getState().clearDevice(deviceId);

  if (!client?.connected) return;

  const topics = [
    `smartplug/${deviceId}/telemetry`,
    `smartplug/${deviceId}/relay/state`,
  ];
  client.unsubscribe(topics, (err) => {
    if (err) console.error('[mqtt] unsubscribe error:', err.message);
  });
}

export async function publishRelayCommand(
  deviceId: string,
  cmd: 'ON' | 'OFF' | 'TOGGLE'
): Promise<void> {
  const c = await getClient();
  const topic = `smartplug/${deviceId}/relay/command`;
  const payload = JSON.stringify({ cmd });

  return new Promise((resolve, reject) => {
    c.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function disconnectMqtt(): void {
  subscribedDeviceIds.clear();
  useDeviceStateStore.getState().clearAll();

  if (client) {
    client.end(true);
    client = null;
  }
  connectPromise = null;
  console.log('[mqtt] disconnected');
}
