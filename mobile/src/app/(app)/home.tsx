import { useEffect } from 'react';
import { ScrollView, View, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell, CheckCircle2, ChevronRight, RefreshCcw, LogOut,
  PlugZap, WifiOff, Zap, Cpu,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

import { useAuthStore } from '../../store/auth-store';
import { useDeviceStateStore } from '../../store/device-state-store';
import { getMe, logoutUser } from '../../api/auth-api';
import { listDevices, type DeviceResponse } from '../../api/devices-api';
import { subscribeToDevices, disconnectMqtt } from '../../lib/mqtt-client';


function DeviceCard({
  device,
  needsSetup,
  livePower,
  liveRelayOn,
  liveIsOnline,
  onPress,
}: {
  device: DeviceResponse;
  needsSetup: boolean;
  livePower: number | null;
  liveRelayOn: boolean;
  liveIsOnline: boolean;
  onPress: () => void;
}) {
  const powerStr = livePower != null ? `${livePower.toFixed(1)} W` : device.is_online ? 'Loading...' : 'Offline';

  return (
    <Pressable onPress={onPress} android_ripple={{ color: '#e5e5e5' }}>

      <Card size="sm" className="w-full rounded-2xl">
        <HStack className="items-center gap-4">
          <View className="relative">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-secondary">
              <Cpu size={22} color="#737373" />
            </View>
            <View
              className={[
                'absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card',
                needsSetup ? 'bg-warning' : liveIsOnline ? 'bg-emerald-500' : 'bg-muted-foreground',
              ].join(' ')}
            />
          </View>

          <VStack className="flex-1 gap-0.5">
            <Text className="text-[15px] font-bold text-foreground">{device.name}</Text>
            <Text className="text-[11px] font-mono text-muted-foreground">{device.device_id}</Text>
          </VStack>

          {needsSetup ? (
            <Badge className="rounded-full bg-warning px-2.5 py-0.5">
              <BadgeText className="text-[10px] font-bold uppercase tracking-wider text-white">
                Finish setup
              </BadgeText>
            </Badge>
          ) : (
            <VStack className="items-end gap-1.5">
              <Text className={`text-[13px] font-semibold ${livePower != null ? 'text-foreground' : 'text-muted-foreground italic'}`}>{powerStr}</Text>
              <View
                className={[
                  'rounded-md px-2.5 py-0.5',
                  liveRelayOn ? 'bg-emerald-500' : 'bg-muted',
                ].join(' ')}
              >
                <Text
                  className={[
                    'text-[10px] font-bold uppercase tracking-wider',
                    liveRelayOn ? 'text-white' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {liveRelayOn ? 'On' : 'Off'}
                </Text>
              </View>
            </VStack>
          )}

          <ChevronRight size={16} color="#9ca3af" />
        </HStack>
      </Card>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <Card size="default" className="w-full items-center rounded-2xl py-10">
      <VStack className="items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
          <PlugZap size={28} color="#737373" />
        </View>
        <VStack className="items-center gap-2">
          <Heading size="md" className="text-center text-foreground">
            No devices yet
          </Heading>
          <Text className="max-w-55 text-center text-sm text-muted-foreground">
            Register your first smart plug to start monitoring energy usage.
          </Text>
        </VStack>
      </VStack>
    </Card>
  );
}

function DeviceSkeleton() {
  return (
    <VStack className="gap-2 mt-2">
      <Card size="sm" className="w-full h-19 rounded-2xl bg-muted/40" />
      <Card size="sm" className="w-full h-19 rounded-2xl bg-muted/40" />
      <Card size="sm" className="w-full h-19 rounded-2xl bg-muted/40" />
    </VStack>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card size="default" className="w-full items-center rounded-2xl py-10">
      <VStack className="items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <WifiOff size={28} color="#ef4444" />
        </View>
        <VStack className="items-center gap-2">
          <Heading size="md" className="text-center text-foreground">
            Connection Error
          </Heading>
          <Text className="text-center text-sm text-muted-foreground px-4">
            Unable to connect to the server. Please check your internet and try again.
          </Text>
        </VStack>
        <Pressable
          onPress={onRetry}
          className="mt-2 flex-row items-center gap-2 rounded-xl bg-secondary px-5 py-3 active:opacity-70"
        >
          <RefreshCcw size={16} color="#171717" />
          <Text className="text-[13px] font-bold uppercase tracking-widest text-foreground">
            Retry
          </Text>
        </Pressable>
      </VStack>
    </Card>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const storeUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const liveDeviceState = useDeviceStateStore((s) => s.devices);

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

  // Devices
  const {
    data: devices = [],
    refetch: refetchDevices,
    isRefetching: isRefetchingDevices,
    isLoading: isLoadingDevices,
    isError: isErrorDevices,
  } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
  });

  const needsSetupDevices = devices.filter((d) => d.last_seen === null);
  const needsSetupCount = needsSetupDevices.length;
  const firstNeedsSetupDevice = needsSetupDevices[0];
  const setupNudgeText = `${needsSetupCount} device${needsSetupCount > 1 ? 's' : ''} need${needsSetupCount > 1 ? '' : 's'} setup`;

  // Subscribe to MQTT topics for all registered devices
  useEffect(() => {
    if (devices.length === 0) return;
    subscribeToDevices(devices.map((d) => d.device_id));
  }, [devices]);

  // Live online status
  const getLiveOnline = (deviceId: string, fallback: boolean): boolean => {
    const live = liveDeviceState[deviceId]?.isOnline;
    return live != null ? live : fallback;
  };

  // Fleet counts
  //const onlineCount = devices.filter((d) => d.is_online).length;
  //const offlineCount = devices.length - onlineCount;
  const provisionedDevices = devices.filter((d) => d.last_seen !== null);
  const onlineCount = provisionedDevices.filter((d) => getLiveOnline(d.device_id, d.is_online)).length;
  const offlineCount = provisionedDevices.length - onlineCount;

  // Helpers to resolve live state from MQTT store, falling back to REST
  const getLiveRelay = (deviceId: string, fallback: boolean): boolean => {
    const confirmed = liveDeviceState[deviceId]?.relayState;
    return confirmed != null ? confirmed.state === 'ON' : fallback;
  };

  const getLivePower = (deviceId: string): number | null =>
    liveDeviceState[deviceId]?.telemetry?.power ?? null;

  const activeRelayCount = provisionedDevices.filter((d) =>
    getLiveRelay(d.device_id, d.relay_state)
  ).length;

  // Total live power across all devices
  const totalLivePower = devices.reduce((sum, d) => {
    const p = getLivePower(d.device_id);
    return sum + (p ?? 0);
  }, 0);

  // Pull-to-refresh
  const isRefetching = isRefetchingMe || isRefetchingDevices;

  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (q) => ['me', 'devices'].includes(q.queryKey[0] as string),
    });
    await Promise.all([refetchMe(), refetchDevices()]);
  };

  // Logout
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

      <HStack className="items-center justify-between border-b border-border bg-card px-5 pb-3 pt-14">
        <HStack className="items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Zap size={18} className='text-primary' strokeWidth={2.5} />
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
            {isLoadingDevices
              ? 'Loading your system...'
              : isErrorDevices
                ? 'System offline.'
                : devices.length === 0
                  ? 'Register your first device to get started.'
                  : offlineCount === 0
                    ? 'All devices are operating normally.'
                    : `${offlineCount} device${offlineCount > 1 ? 's' : ''} offline.`}
          </Text>
          {needsSetupCount > 0 ? (
            <Pressable
              onPress={() => router.push(
                needsSetupCount === 1 && firstNeedsSetupDevice
                  ? {
                      pathname: '/(app)/add-device/wifi-setup',
                      params: { device_id: firstNeedsSetupDevice.device_id },
                    }
                  : '/(app)/devices'
              )}
              className="self-start"
            >
              <Badge className="rounded-full bg-warning">
                <BadgeText className="text-[11px] font-bold uppercase tracking-widest text-white">
                  {setupNudgeText}
                </BadgeText>
              </Badge>
            </Pressable>
          ) : null}
        </VStack>

        {!isLoadingDevices && !isErrorDevices && devices.length > 0 && (
          <Card size="sm" className="w-full rounded-2xl">
            <VStack className="gap-3">
              <HStack className="items-center justify-between">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Fleet Overview
                </Text>
                <Badge
                  className={`rounded-full ${offlineCount === 0 ? 'bg-success' : 'bg-warning'}`}
                >
                  <BadgeText>{offlineCount === 0 ? 'Optimal' : 'Attention'}</BadgeText>
                </Badge>
              </HStack>

              <HStack className="gap-3">
                <VStack className="flex-1 gap-1 rounded-xl border border-border bg-secondary p-3">
                  <HStack className="items-center gap-1.5">
                    <CheckCircle2 size={14} color="#10b981" />
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Online
                    </Text>
                  </HStack>
                  <Text className="text-2xl font-black text-foreground">{onlineCount}</Text>
                </VStack>

                <VStack className="flex-1 gap-1 rounded-xl border border-border bg-secondary p-3">
                  <HStack className="items-center gap-1.5">
                    <WifiOff size={14} color="#9ca3af" />
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Offline
                    </Text>
                  </HStack>
                  <Text className="text-2xl font-black text-foreground">{offlineCount}</Text>
                </VStack>

                <VStack className="flex-1 gap-1 rounded-xl border border-border bg-secondary p-3">
                  <HStack className="items-center gap-1.5">
                    <PlugZap size={14} color="#171717" />
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Active
                    </Text>
                  </HStack>
                  <Text className="text-2xl font-black text-foreground">{activeRelayCount}</Text>
                </VStack>
              </HStack>

              {onlineCount > 0 && (
                <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3">
                  <Text className="text-[13px] text-muted-foreground">Total Current Load</Text>
                  <Text className="text-[15px] font-bold text-foreground">
                    {totalLivePower.toFixed(1)} W
                  </Text>
                </HStack>
              )}
            </VStack>
          </Card>
        )}

        <VStack className="gap-2">
          <Text className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {devices.length > 0 ? 'Your Devices' : ''}
          </Text>

          {isLoadingDevices ? (
            <DeviceSkeleton />
          ) : isErrorDevices ? (
            <ErrorState onRetry={refetchDevices} />
          ) : devices.length === 0 ? (
            <EmptyState />
          ) : (
            devices.map((device) => (
              <DeviceCard
                key={device.device_id}
                device={device}
                needsSetup={device.last_seen === null}
                livePower={getLivePower(device.device_id)}
                liveRelayOn={getLiveRelay(device.device_id, device.relay_state)}
                liveIsOnline={getLiveOnline(device.device_id, device.is_online)} // <-- PASS IT HERE
                onPress={() => (
                  device.last_seen === null
                    ? router.push({
                        pathname: '/(app)/add-device/wifi-setup',
                        params: { device_id: device.device_id },
                      })
                    : router.push(`/(app)/device/${device.device_id}`)
                )}
              />
            ))
          )}
        </VStack>
      </ScrollView>
    </View>
  );
}
