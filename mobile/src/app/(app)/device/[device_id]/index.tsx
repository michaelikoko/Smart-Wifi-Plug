/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import {
    Activity,
    AlertTriangle,
    Battery,
    CircleDot,
    Clock,
    Gauge,
    Radio,
    ToggleLeft,
    ToggleRight,
    Wifi,
    Zap,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { WeeklyBars, type WeeklyBarDatum } from '@/components/app-ui';
import { listDevices } from '../../../../api/devices-api';
import { getEnergyHistory, is404 } from '../../../../api/telemetry-api';
import { rearmTimerLock } from '../../../../api/timers-api';
import { publishRelayCommand } from '../../../../lib/mqtt-client';
import { useDeviceStateStore } from '../../../../store/device-state-store';

import { StatTile } from './_components';
import { addUtcDays, dayLabel, rssiLabel } from './_utils';

function getRelayStatusLabel(params: {
    isToggling: boolean;
    isOverLimit: boolean;
    isTimerLocked: boolean;
    relayIsOn: boolean;
}): string {
    const { isToggling, isOverLimit, isTimerLocked, relayIsOn } = params;
    if (isToggling) return 'Switching...';
    if (isOverLimit) return 'Limit exceeded';
    if (isTimerLocked) return 'Timer locked';
    return relayIsOn ? 'Turned On' : 'Turned Off';
}

export default function DeviceOverviewScreen() {
    const { device_id } = useLocalSearchParams<{ device_id: string }>();
    const queryClient = useQueryClient();

    const liveState = useDeviceStateStore((s) => s.devices[device_id]);
    const telemetry = liveState?.telemetry ?? null;
    const relayConfirmed = liveState?.relayState ?? null;
    const timerLock = liveState?.timerLock ?? null;
    const isTimerLocked = timerLock?.locked === true;

    const isOnline = liveState?.isOnline ?? null;
    const currentEnergyReadings = liveState?.currentEnergyReadings ?? null;
    const monthlyEnergyReadings = liveState?.monthlyEnergyReadings ?? null;

    const [isToggling, setIsToggling] = useState(false);

    const { data: devices = [] } = useQuery({
        queryKey: ['devices'],
        queryFn: listDevices,
        staleTime: Infinity,
    });
    const device = devices.find((d) => d.device_id === device_id);

    const relayIsOn = relayConfirmed != null
        ? relayConfirmed.state === 'ON'
        : (device?.relay_state ?? false);

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

    const dailyKwh = currentEnergyReadings?.kwh_consumed ?? 0;
    const monthlyKwh = monthlyEnergyReadings?.kwh_consumed ?? 0;

    const isOverDailyLimit = device?.auto_cutoff_enabled === true
        && device.daily_limit_kwh != null
        && dailyKwh > device.daily_limit_kwh;

    const isOverMonthlyLimit = device?.auto_cutoff_enabled === true
        && device.monthly_limit_kwh != null
        && monthlyKwh > device.monthly_limit_kwh;

    const isOverLimit = isOverDailyLimit || isOverMonthlyLimit;
    const isLocked = isOverLimit || isTimerLocked;

    const weeklyData: WeeklyBarDatum[] = (() => {
        const todayDate = new Date().toISOString().slice(0, 10);
        const windowDates = Array.from({ length: 7 }, (_, idx) => addUtcDays(todayDate, idx - 6));

        const historyByDate = new Map(
            (energyHistory ?? []).map((row) => [row.date, row])
        );

        if (currentEnergyReadings) {
            historyByDate.set(currentEnergyReadings.date, {
                device_id: currentEnergyReadings.device_id,
                date: currentEnergyReadings.date,
                kwh_consumed: currentEnergyReadings.kwh_consumed,
                peak_power: currentEnergyReadings.peak_power,
                estimated_cost: currentEnergyReadings.estimated_cost,
            });
        }

        return windowDates.map((date) => {
            const row = historyByDate.get(date);
            return {
                day: dayLabel(date),
                date,
                kwh: row?.kwh_consumed ?? 0,
                costKobo: row?.estimated_cost ?? null,
            };
        });
    })();

    const isRefetching = isRefetchingHistory;

    const onRefresh = async () => {
        await queryClient.invalidateQueries({
            predicate: (q) =>
                ['energy-today', 'energy-history', 'energy-monthly'].includes(q.queryKey[0] as string) &&
                q.queryKey[1] === device_id,
        });
    };

    const relayMutation = useMutation({
        mutationFn: (nextState: boolean) =>
            publishRelayCommand(device_id, nextState ? 'ON' : 'OFF'),
        onMutate: () => setIsToggling(true),
        onError: (err) => {
            console.error('[relay] publish failed:', err);
            setIsToggling(false);
        },
    });

    const rearmMutation = useMutation({
        mutationFn: () => rearmTimerLock(device_id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['devices'] });
        },
    });

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

    const relayStatusLabel = getRelayStatusLabel({
        isToggling,
        isOverLimit,
        isTimerLocked,
        relayIsOn,
    });

    return (
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
            {isOverLimit && (
                <Card size="sm" className="w-full rounded-2xl border-destructive bg-destructive/10">
                    <HStack className="items-center gap-3">
                        <AlertTriangle size={18} color="#E7000B" />
                        <VStack className="flex-1 gap-0.5">
                            <Text className="text-[13px] font-bold text-destructive">
                                Energy limit exceeded
                            </Text>
                            <Text className="text-[11px] text-destructive/80">
                                {isOverDailyLimit
                                    ? `Daily usage ${dailyKwh.toFixed(3)} kWh exceeds your ${device!.daily_limit_kwh} kWh limit.`
                                    : `Monthly usage ${monthlyKwh.toFixed(3)} kWh exceeds your ${device!.monthly_limit_kwh} kWh limit.`}
                                {' '}Raise your limit to re-arm.
                            </Text>
                        </VStack>
                    </HStack>
                </Card>
            )}

            {isTimerLocked && (
                <Card size="sm" className="w-full rounded-2xl border-primary bg-primary/10">
                    <VStack className="gap-3">
                        <HStack className="items-center gap-3">
                            <Clock size={18} color="#171717" />
                            <VStack className="flex-1 gap-0.5">
                                <Text className="text-[13px] font-bold text-foreground">
                                    Timer lock active
                                </Text>
                                <Text className="text-[11px] text-muted-foreground">
                                    {timerLock?.reason ?? 'A timer changed this device\'s relay state.'}
                                </Text>
                            </VStack>
                        </HStack>
                        <Pressable
                            onPress={() => rearmMutation.mutate()}
                            disabled={rearmMutation.isPending}
                            className="items-center justify-center rounded-2xl bg-primary px-5 py-3 disabled:opacity-60"
                        >
                            <Text className="text-[13px] font-bold uppercase tracking-widest text-primary-foreground">
                                {rearmMutation.isPending ? 'Rearming...' : 'Rearm'}
                            </Text>
                        </Pressable>
                    </VStack>
                </Card>
            )}

            <Card size="sm" className="w-full rounded-2xl">
                <HStack className="items-center justify-between">
                    <VStack className="gap-1">
                        <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Relay Control
                        </Text>
                        <Text className="text-[15px] font-bold text-foreground">
                            {relayStatusLabel}
                        </Text>
                    </VStack>

                    <Pressable
                        onPress={handleRelayToggle}
                        disabled={isToggling || !isOnline || isLocked}
                        className={[
                            'rounded-2xl px-5 py-3.5 flex-row items-center gap-2 disabled:bg-muted disabled:opacity-60',
                            isToggling || isLocked ? 'opacity-60 bg-muted' :
                                relayIsOn ? 'bg-success' : 'bg-destructive',
                        ].join(' ')}
                    >
                        {isOnline ? isToggling ? (
                            <Spinner size="small" />
                        ) : relayIsOn ? (
                            <ToggleRight size={20} color="#fff" />
                        ) : (
                            <ToggleLeft size={20} color="#fff" />
                        ) : null}
                        <Text className="text-[13px] font-bold uppercase tracking-widest text-white">
                            {!isOnline ? 'Offline' : relayStatusLabel}
                        </Text>
                    </Pressable>
                </HStack>
            </Card>

            <Card size="sm" className="w-full rounded-2xl">
                <VStack className="gap-3">
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Live Readings
                    </Text>

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
                            Today&apos;s Usage
                        </Text>
                        {currentEnergyReadings ? (
                            <HStack className="items-center gap-1">
                                <CircleDot size={10} color={isOnline ? '#10b981' : '#a3a3a3'} />
                                <Text className={`text-[10px] ${isOnline ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                    {isOnline ? 'Live' : 'Synced'}
                                </Text>
                            </HStack>
                        ) : (
                            <Text className="text-[10px] text-muted-foreground">Waiting for data...</Text>
                        )}
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
                <VStack className="gap-3">
                    <HStack className="items-center justify-between">
                        <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            This Month&apos;s Usage
                        </Text>
                        {monthlyEnergyReadings ? (
                            <HStack className="items-center gap-1">
                                <CircleDot size={10} color={isOnline ? '#10b981' : '#a3a3a3'} />
                                <Text className={`text-[10px] ${isOnline ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                    {isOnline ? 'Live' : 'Synced'}
                                </Text>
                            </HStack>
                        ) : (
                            <Text className="text-[10px] text-muted-foreground">Waiting for data...</Text>
                        )}
                    </HStack>

                    <HStack className="gap-2">
                        <VStack className="flex-1 gap-1.5 rounded-xl border border-border bg-secondary p-3.5">
                            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Total Energy
                            </Text>
                            <HStack className="items-end gap-1">
                                <Text className="text-2xl font-black text-foreground">
                                    {monthlyEnergyReadings ? monthlyEnergyReadings.kwh_consumed.toFixed(3) : '—'}
                                </Text>
                                <Text className="mb-0.5 text-[12px] font-semibold text-muted-foreground">kWh</Text>
                            </HStack>
                        </VStack>

                        <VStack className="flex-1 gap-1.5 rounded-xl border border-border bg-secondary p-3.5 justify-center">
                            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Billing Period
                            </Text>
                            <Text className="text-base font-bold text-foreground mt-1">
                                {monthlyEnergyReadings?.month
                                    ? new Date(monthlyEnergyReadings.month + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                                    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </Text>
                        </VStack>
                    </HStack>

                    {monthlyEnergyReadings?.estimated_cost != null && (
                        <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3">
                            <Text className="text-[13px] text-muted-foreground">Estimated Monthly Cost</Text>
                            <Text className="text-[15px] font-bold text-foreground">
                                ₦{(monthlyEnergyReadings.estimated_cost / 100).toFixed(2)}
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
    );
}