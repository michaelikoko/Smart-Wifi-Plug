import { useEffect, useState } from 'react';
import { ScrollView, View, RefreshControl, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft, Activity, Battery, CircleDot,
    Gauge, Radio, ToggleLeft, ToggleRight, Wifi, Zap,
} from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

import { WeeklyBars, type WeeklyBarDatum } from '@/components/app-ui';
import { useDeviceStateStore } from '../../../store/device-state-store';
import { listDevices } from '../../../api/devices-api';
import { getTodayEnergy, getEnergyHistory, is404 } from '../../../api/telemetry-api';
import { publishRelayCommand } from '../../../lib/mqtt-client';

// Helpers 
function dayLabel(dateStr: string): string {
    /* Returns a short day label for a given date string. */
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'UTC',
    });
}

function rssiLabel(rssi: number): { label: string; color: string } {
    /* RSSI → signal quality label + color*/
    if (rssi >= -50) return { label: 'Excellent', color: '#10b981' };
    if (rssi >= -60) return { label: 'Good', color: '#3b82f6' };
    if (rssi >= -70) return { label: 'Fair', color: '#f59e0b' };
    return { label: 'Weak', color: '#ef4444' };
}

// Telemetry stat tile 
function StatTile({
    icon: Icon,
    label,
    value,
    unit,
    iconColor = '#737373',
    valueColor,
}: {
    icon: typeof Zap;
    label: string;
    value: string;
    unit?: string;
    iconColor?: string;
    valueColor?: string;
}) {
    return (
        <VStack className="flex-1 gap-2 rounded-xl border border-border bg-secondary p-3.5 min-w-[45%]">
            <HStack className="items-center gap-1.5">
                <Icon size={14} color={iconColor} />
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {label}
                </Text>
            </HStack>
            <HStack className="items-end gap-1">
                <Text
                    className="text-2xl font-black text-foreground"
                    style={valueColor ? { color: valueColor } : undefined}
                >
                    {value}
                </Text>
                {unit ? (
                    <Text className="mb-0.5 text-[12px] font-semibold text-muted-foreground">{unit}</Text>
                ) : null}
            </HStack>
        </VStack>
    );
}

// Screen 
export default function DeviceDetailScreen() {
    const { device_id } = useLocalSearchParams<{ device_id: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();

    const liveState = useDeviceStateStore((s) => s.devices[device_id]);
    const telemetry = liveState?.telemetry ?? null;
    const relayConfirmed = liveState?.relayState ?? null;

    // Live isOnline staus and currentEnergyReadings
    const isOnline = liveState?.isOnline ?? null; // null = unknown, true = online, false = offline
    const currentEnergyReadings = liveState?.currentEnergyReadings ?? null; // null = unknown, CurrentEnergyResponse = latest summary

    const [isToggling, setIsToggling] = useState(false);

    // Pull device metadata from the already-fetched devices query cache.
    // No separate network call — the list is fetched on home.tsx mount.
    const { data: devices = [] } = useQuery({
        queryKey: ['devices'],
        queryFn: listDevices,
        staleTime: Infinity, // home.tsx manages invalidation
    });
    const device = devices.find((d) => d.device_id === device_id);

    // Resolve relay state: MQTT confirmation > REST fallback
    const relayIsOn = relayConfirmed != null
        ? relayConfirmed.state === 'ON'
        : (device?.relay_state ?? false);

    /*
    // Today's energy
    const {
        data: todayEnergy,
        refetch: refetchToday,
        isRefetching: isRefetchingToday,
    } = useQuery({
        queryKey: ['energy-today', device_id],
        queryFn: () => getTodayEnergy(device_id),
        enabled: !!device_id,
        staleTime: 30_000,
        retry: (failureCount, error) => (!is404(error) && failureCount < 2),
    });
    */

    // 7-day energy history
    const {
        data: energyHistory,
        refetch: refetchHistory,
        isRefetching: isRefetchingHistory,
    } = useQuery({
        queryKey: ['energy-history', device_id],
        queryFn: () => getEnergyHistory(device_id, 7),
        enabled: !!device_id,
        staleTime: 5 * 60_000,
        retry: (failureCount, error) => (!is404(error) && failureCount < 2),
    });

    const weeklyData: WeeklyBarDatum[] = (energyHistory ?? [])
        .slice()
        .reverse()
        .map((row) => ({
            day: dayLabel(row.date),
            kwh: row.kwh_consumed,
            costKobo: row.estimated_cost ?? null,
        }));

    // Pull-to-refresh — only REST data, MQTT is always live
    //const isRefetching = isRefetchingToday || isRefetchingHistory;
    const isRefetching =  isRefetchingHistory;

    const onRefresh = async () => {
        await queryClient.invalidateQueries({
            predicate: (q) =>
                ['energy-today', 'energy-history'].includes(q.queryKey[0] as string) &&
                q.queryKey[1] === device_id,
        });
        //await Promise.all([refetchToday(), refetchHistory()]);
        await Promise.all([ refetchHistory()]);
    };

    // Relay toggle
    const relayMutation = useMutation({
        mutationFn: (nextState: boolean) =>
            publishRelayCommand(device_id, nextState ? 'ON' : 'OFF'),
        onMutate: () => setIsToggling(true),
        onError: (err) => {
            console.error('[relay] publish failed:', err);
            setIsToggling(false);
        },
    });

    // Clear toggling once MQTT relay/state confirmation arrives
    useEffect(() => {
        if (relayConfirmed != null && isToggling) {
            setIsToggling(false);
        }
    }, [relayConfirmed]);

    const handleRelayToggle = () => {
        if (isToggling) return;
        relayMutation.mutate(!relayIsOn);
    };


    const rssiInfo = telemetry ? rssiLabel(telemetry.rssi) : null;

    return (
        <View className="flex-1 bg-secondary dark:bg-background">

            <View className="border-b border-border bg-card px-5 pb-4 pt-14">
                <HStack className="items-center gap-3">
                    <Pressable
                        className="h-9 w-9 items-center justify-center rounded-xl bg-secondary"
                        onPress={() => router.back()}
                    >
                        <ArrowLeft size={20} color="#171717" />
                    </Pressable>

                    <VStack className="flex-1 gap-0">
                        <Heading size="lg" className="text-foreground">
                            {device?.name ?? device_id}
                        </Heading>
                        <Text className="font-mono text-[11px] text-muted-foreground">{device_id}</Text>
                    </VStack>

                    {device && (
                        <Badge
                            className={`rounded-full ${isOnline ? 'bg-success' : 'bg-destructive'}`}
                        >
                            <BadgeText>{isOnline ? 'Online' : 'Offline'}</BadgeText>
                        </Badge>
                    )}
                </HStack>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="px-4 py-5 gap-4 pb-8"
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

                <Card size="sm" className="w-full rounded-2xl">
                    <HStack className="items-center justify-between">
                        <VStack className="gap-1">
                            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Relay Control
                            </Text>
                            <Text className="text-[15px] font-bold text-foreground">
                                {isToggling ? 'Switching...' : relayIsOn ? 'Turned On' : 'Turned Off'}
                            </Text>
                        </VStack>

                        <Pressable
                            onPress={handleRelayToggle}
                            disabled={isToggling || !isOnline}
                            className={['rounded-2xl px-5 py-3.5 flex-row items-center gap-2 disabled:bg-muted disabled:opacity-60',
                                isToggling ? 'opacity-60 bg-muted' :
                                    relayIsOn ? 'bg-success' : 'bg-destructive',
                            ].join(' ')}
                        >
                            {isToggling ? (
                                <Spinner size="small" />
                            ) : relayIsOn ? (
                                <ToggleRight size={20} color="#fff" />
                            ) : (
                                <ToggleLeft size={20} color="#fff" />
                            )}
                            <Text className="text-[13px] font-bold uppercase tracking-widest text-white">
                                {relayIsOn ? 'On' : 'Off'}
                            </Text>
                        </Pressable>
                    </HStack>
                </Card>

                <Card size="sm" className="w-full rounded-2xl">
                    <VStack className="gap-3">
                        <HStack className="items-center justify-between">
                            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Live Readings
                            </Text>
                            {telemetry ? (
                                <HStack className="items-center gap-1">
                                    <CircleDot size={10} color="#10b981" />
                                    <Text className="text-[10px] text-emerald-600">Live</Text>
                                </HStack>
                            ) : (
                                <Text className="text-[10px] text-muted-foreground">Waiting for data...</Text>
                            )}
                        </HStack>

                        {telemetry ? (
                            <VStack className="gap-2">
                                <HStack className="gap-2">
                                    <StatTile
                                        icon={Zap}
                                        label="Voltage"
                                        value={telemetry.voltage.toFixed(1)}
                                        unit="V"
                                        iconColor="#f59e0b"
                                    />
                                    <StatTile
                                        icon={Activity}
                                        label="Current"
                                        value={telemetry.current.toFixed(3)}
                                        unit="A"
                                        iconColor="#3b82f6"
                                    />
                                </HStack>

                                <HStack className="gap-2">
                                    <StatTile
                                        icon={Gauge}
                                        label="Power"
                                        value={telemetry.power.toFixed(1)}
                                        unit="W"
                                        iconColor="#8b5cf6"
                                    />
                                    <StatTile
                                        icon={Radio}
                                        label="Frequency"
                                        value={telemetry.frequency.toFixed(1)}
                                        unit="Hz"
                                        iconColor="#06b6d4"
                                    />
                                </HStack>

                                <HStack className="gap-2">
                                    <StatTile
                                        icon={Battery}
                                        label="Power Factor"
                                        value={telemetry.pf.toFixed(2)}
                                        iconColor="#10b981"
                                    />
                                    <StatTile
                                        icon={Wifi}
                                        label="Signal"
                                        value={`${telemetry.rssi}`}
                                        unit="dBm"
                                        iconColor={rssiInfo?.color}
                                        valueColor={rssiInfo?.color}
                                    />
                                </HStack>

                                {rssiInfo && (
                                    <Text className="text-right text-[11px] font-semibold"
                                        style={{ color: rssiInfo.color }}>
                                        {rssiInfo.label} signal
                                    </Text>
                                )}
                            </VStack>
                        ) : (
                            <View className="items-center py-8">
                                <Text className="text-[13px] text-muted-foreground">
                                    {device?.is_online
                                        ? 'Waiting for first telemetry reading...'
                                        : 'Device is offline — no live readings available.'}
                                </Text>
                            </View>
                        )}
                    </VStack>
                </Card>

                <Card size="sm" className="w-full rounded-2xl">
                    <VStack className="gap-3">
                        <HStack className="items-center justify-between">
                            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Today's Usage
                            </Text>
                            <HStack className="items-center gap-1">
                                <CircleDot size={10} color="#10b981" />
                                <Text className="text-[10px] text-emerald-600">Live</Text>
                            </HStack>
                        </HStack>

                        <HStack className="gap-2">
                            <VStack className="flex-1 gap-1.5 rounded-xl border border-border bg-secondary p-3.5">
                                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Energy
                                </Text>
                                <HStack className="items-end gap-1">
                                    <Text className="text-2xl font-black text-foreground">
                                        {currentEnergyReadings ? currentEnergyReadings.kwh_consumed.toFixed(3) : '—'}
                                    </Text>
                                    <Text className="mb-0.5 text-[12px] font-semibold text-muted-foreground">kWh</Text>
                                </HStack>
                            </VStack>

                            <VStack className="flex-1 gap-1.5 rounded-xl border border-border bg-secondary p-3.5">
                                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Peak Power
                                </Text>
                                <HStack className="items-end gap-1">
                                    <Text className="text-2xl font-black text-foreground">
                                        {currentEnergyReadings ? currentEnergyReadings.peak_power.toFixed(1) : '—'}
                                    </Text>
                                    <Text className="mb-0.5 text-[12px] font-semibold text-muted-foreground">W</Text>
                                </HStack>
                            </VStack>
                        </HStack>

                        {currentEnergyReadings?.estimated_cost != null && (
                            <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3">
                                <Text className="text-[13px] text-muted-foreground">Estimated Cost</Text>
                                <Text className="text-[15px] font-bold text-foreground">
                                    ₦{(currentEnergyReadings.estimated_cost / 100).toFixed(2)}
                                </Text>
                            </HStack>
                        )}
                    </VStack>
                </Card>

                <Card size="sm" className="w-full rounded-2xl">
                    <WeeklyBars data={weeklyData} />
                </Card>

                {device?.last_seen && (
                    <Text className="text-center text-[11px] text-muted-foreground">
                        Last seen: {new Date(device.last_seen).toLocaleString()}
                    </Text>
                )}

            </ScrollView>
        </View>
    );
}