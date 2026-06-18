import { useEffect, useState } from 'react';
import { ScrollView, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, CheckCircle2, CircleX, LogOut, PlugZap, Zap } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';

import { MetricCard, RelayRow, WeeklyBars, type WeeklyBarDatum } from '@/components/app-ui';
import { useAuthStore } from '../../store/auth-store';
import { useDeviceStateStore } from '../../store/device-state-store';
import { getMe, logoutUser } from '../../api/auth-api';
import { listDevices } from '../../api/devices-api';
import { getTodayEnergy, getEnergyHistory, is404 } from '../../api/telemetry-api';
import {
  subscribeToDevices,
  publishRelayCommand,
  disconnectMqtt,
} from '../../lib/mqtt-client';

function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const storeUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // Live MQTT data for all devices — updates automatically as messages arrive.
  const liveDeviceState = useDeviceStateStore((s) => s.devices);

  // Per-device optimistic "toggling" flag: set on publish, cleared when the
  // relay/state confirmation arrives from the device via MQTT subscription.
  const [togglingDeviceIds, setTogglingDeviceIds] = useState<Set<string>>(new Set());

  // /auth/me 
  const {
    data: user,
    refetch: refetchMe,
    isRefetching: isRefetchingMe,
  } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    initialData: storeUser ?? undefined,
  });

  useEffect(() => {
    if (user) setUser(user);
  }, [user, setUser]);

  const firstName = user?.full_name?.split(' ')[0] ?? 'Operator';

  // Device list 
  // Fetch on mount → drives MQTT subscriptions + REST telemetry queries.
  // REST device list gives us ownership info and the last-known relay_state
  // from the backend (used as the initial state before MQTT messages arrive).
  const {
    data: devices = [],
    refetch: refetchDevices,
    isRefetching: isRefetchingDevices,
  } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
  });

  // Subscribe to MQTT topics for all registered devices.
  // Effect re-runs if the device list changes (e.g. after registering a new device).
  useEffect(() => {
    if (devices.length === 0) return;
    subscribeToDevices(devices.map((d) => d.device_id));
  }, [devices]);

  const primaryDevice = devices[0];

  // Resolve online/offline from the REST device list (set by backend's
  // MQTT on_status handler + staleness sweep). Not driven by MQTT client-side
  // to avoid duplicating the backend's own staleness logic.
  const onlineCount = devices.filter((d) => d.is_online).length;
  const offlineCount = devices.length - onlineCount;

  // Today's energy summary (REST, pull-to-refresh) 
  // Design choice: fetch once on mount, user refreshes via pull-to-refresh.
  // The backend updates DeviceDailySummary on every telemetry write (~10s),
  // so a pull-to-refresh gives the user a reasonably fresh number without
  // continuous polling. Live "current power" comes from MQTT below.
  const {
    data: todayEnergy,
    refetch: refetchToday,
    isRefetching: isRefetchingToday,
  } = useQuery({
    queryKey: ['energy-today', primaryDevice?.device_id],
    queryFn: () => getTodayEnergy(primaryDevice!.device_id),
    enabled: !!primaryDevice,
    staleTime: 30_000, // treat as fresh for 30s to avoid redundant refetches
    retry: (failureCount, error) => (!is404(error) && failureCount < 2),
  });

  // 7-day energy history (REST, pull-to-refresh) 
  // Changes at most once per day — staleTime of 5 min is appropriate.
  const {
    data: energyHistory,
    refetch: refetchHistory,
    isRefetching: isRefetchingHistory,
  } = useQuery({
    queryKey: ['energy-history', primaryDevice?.device_id],
    queryFn: () => getEnergyHistory(primaryDevice!.device_id, 7),
    enabled: !!primaryDevice,
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => (!is404(error) && failureCount < 2),
  });

  const weeklyData: WeeklyBarDatum[] = (energyHistory ?? [])
    .slice()
    .reverse()
    .map((row) => ({ day: dayLabel(row.date), kwh: row.kwh_consumed, costKobo: row.estimated_cost }));

  // Pull-to-refresh 
  const isRefetching =
    isRefetchingMe || isRefetchingDevices || isRefetchingToday || isRefetchingHistory;

  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (q) =>
        ['me', 'devices', 'energy-today', 'energy-history'].includes(q.queryKey[0] as string),
    });
    await Promise.all([
      refetchMe(),
      refetchDevices(),
      primaryDevice ? refetchToday() : Promise.resolve(),
      primaryDevice ? refetchHistory() : Promise.resolve(),
    ]);
  };

  // Relay toggle 
  //
  // Flow:
  //   1. Publish ON/OFF to relay/command via MQTT (QoS 1, broker ACK).
  //   2. Set device as "toggling" (spinner on RelayRow).
  //   3. Device acts, publishes confirmed state to relay/state topic.
  //   4. _handleMessage in mqtt-client.ts writes it into useDeviceStateStore.
  //   5. relayIsOn() below reads from the store → RelayRow re-renders.
  //   6. useEffect below sees the confirmed state and clears the toggling flag.
  //
  // No arbitrary timeout, no polling. The state is always what the device said.

  const relayMutation = useMutation({
    mutationFn: async ({ deviceId, nextState }: { deviceId: string; nextState: boolean }) => {
      await publishRelayCommand(deviceId, nextState ? 'ON' : 'OFF');
    },
    onMutate: ({ deviceId }) => {
      setTogglingDeviceIds((prev) => new Set(prev).add(deviceId));
    },
    onError: (err, { deviceId }) => {
      console.error('[relay] publish failed:', err);
      setTogglingDeviceIds((prev) => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    },
    // onSettled deliberately left out — clearing happens when the
    // relay/state confirmation arrives (see useEffect below).
  });

  // Clear toggling state for any device whose relay/state has been confirmed.
  // This runs whenever the live store updates, which happens every time
  // a relay/state message is received from the broker.
  useEffect(() => {
    setTogglingDeviceIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      prev.forEach((deviceId) => {
        if (liveDeviceState[deviceId]?.relayState != null) {
          next.delete(deviceId);
        }
      });
      return next.size === prev.size ? prev : next;
    });
  }, [liveDeviceState]);

  const handleToggleRelay = (deviceId: string, currentRelayOn: boolean) => {
    relayMutation.mutate({ deviceId, nextState: !currentRelayOn });
  };

  // Derive relay state: prefer live MQTT confirmation, fall back to
  // last-known state from the REST device list (accurate at load time).
  const relayIsOn = (deviceId: string, fallback: boolean): boolean => {
    const confirmed = liveDeviceState[deviceId]?.relayState;
    if (confirmed != null) return confirmed.state === 'ON';
    return fallback;
  };

  // Live current power from MQTT — updates every ~10s as readings arrive.
  // Falls back to todayEnergy.peak_power (REST) until the first MQTT message.
  const livePower = primaryDevice
    ? (liveDeviceState[primaryDevice.device_id]?.telemetry?.power ?? null)
    : null;

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      disconnectMqtt();
      queryClient.clear();
      useDeviceStateStore.getState().clearAll();
    },
    onSettled: () => router.replace('/(auth)/login'),
  });

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-secondary dark:bg-background">
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-secondary dark:bg-background">

      {/* Top bar */}
      <HStack className="items-center justify-between border-b border-border bg-card px-5 pb-3 pt-14">
        <HStack className="items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Zap size={18} className="text-primary" strokeWidth={2.5} />
          </View>
          <VStack className="gap-0">
            <Text className="text-[17px] font-extrabold text-foreground">SmartPlug</Text>
            <Text className="text-[11px] text-muted-foreground">Energy control</Text>
          </VStack>
        </HStack>

        <HStack className="items-center gap-2">
          <Pressable className="relative h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <Bell size={20} color="#171717" />
            <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          </Pressable>

          <Pressable
            className="h-10 w-10 items-center justify-center rounded-xl bg-secondary"
            onPress={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending
              ? <Spinner size="small" />
              : <LogOut size={18} color="#737373" />}
          </Pressable>
        </HStack>
      </HStack>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 py-5 gap-4 pb-6"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor="#171717"
            colors={['#171717']}
            progressBackgroundColor="#ffffff"
          />
        }
      >
        <VStack className="gap-0.5 px-1">
          <Heading size="xl" className="text-foreground">Hello, {firstName}</Heading>
          <Text className="text-[13px] text-muted-foreground">
            {devices.length === 0
              ? 'No devices registered yet.'
              : offlineCount === 0
                ? 'System is operating normally.'
                : `${offlineCount} device${offlineCount > 1 ? 's' : ''} offline.`}
          </Text>
        </VStack>

        {/* System Overview */}
        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <HStack className="items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                System Overview
              </Text>
              <Badge className={`rounded-full ${offlineCount === 0 ? 'bg-success' : 'bg-warning'}`}>
                <BadgeText>{offlineCount === 0 ? 'Optimal' : 'Attention'}</BadgeText>
              </Badge>
            </HStack>
            <VStack className="gap-3">
              <HStack className="gap-3">
                {/* Current power from live MQTT reading */}
                <MetricCard
                  label="Current Load"
                  value={livePower != null ? livePower.toFixed(1) : '—'}
                  unit="W"
                />
                {/* Today's kWh from REST daily summary (pull-to-refresh) */}
                <MetricCard
                  label="Energy Today"
                  value={todayEnergy ? todayEnergy.kwh_consumed.toFixed(2) : '—'}
                  unit="kWh"
                />
              </HStack>
              {/* NEW: Estimated Cost */}
              <MetricCard
                label="Est. Cost"
                value={
                  todayEnergy?.estimated_cost != null
                    ? `₦${(todayEnergy.estimated_cost / 100).toFixed(2)}`
                    : '—'
                }
                unit=""
              />
            </VStack>
          </VStack>
        </Card>

        {/* Device Status */}
        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Device Status
            </Text>
            <VStack className="gap-2">
              <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3.5">
                <HStack className="items-center gap-2.5">
                  <CheckCircle2 size={17} color="#10b981" />
                  <Text className="text-[13px] text-foreground">Online Devices</Text>
                </HStack>
                <Text className="text-[15px] font-bold text-foreground">{onlineCount}</Text>
              </HStack>
              <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3.5">
                <HStack className="items-center gap-2.5">
                  <CircleX size={17} color="#9ca3af" />
                  <Text className="text-[13px] text-foreground">Offline Devices</Text>
                </HStack>
                <Text className="text-[15px] font-bold text-foreground">{offlineCount}</Text>
              </HStack>
            </VStack>
          </VStack>
        </Card>

        {/* Weekly chart (REST, 7-day history) */}
        <Card size="sm" className="w-full rounded-2xl">
          <WeeklyBars data={weeklyData} />
        </Card>

        {/* Relay Control */}
        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <HStack className="items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Relay Control
              </Text>
              <HStack className="items-center gap-1.5">
                <PlugZap size={14} color="#171717" />
                <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                  {devices.filter((d) => relayIsOn(d.device_id, d.relay_state)).length} Active
                </Text>
              </HStack>
            </HStack>
            <VStack className="gap-2.5">
              {devices.length === 0 ? (
                <Text className="py-2 text-center text-[13px] text-muted-foreground">
                  No devices registered yet.
                </Text>
              ) : (
                devices.map((device) => {
                  const isOn = relayIsOn(device.device_id, device.relay_state);
                  const isToggling = togglingDeviceIds.has(device.device_id);
                  return (
                    <RelayRow
                      key={device.device_id}
                      name={device.name}
                      relay={device.device_id}
                      active={isOn}
                      isToggling={isToggling}
                      onToggle={() => handleToggleRelay(device.device_id, isOn)}
                    />
                  );
                })
              )}
            </VStack>
          </VStack>
        </Card>
      </ScrollView>
    </View>
  );
}