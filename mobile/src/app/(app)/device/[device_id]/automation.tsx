/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Pencil, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput } from 'react-native';

import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FormScreen } from '@/components/app-ui';

import { listDevices, updateDeviceLimits } from '../../../../api/devices-api';
import { createTimer, deleteTimer, listTimers, updateTimer, type TimerResponse } from '../../../../api/timers-api';

export default function DeviceAutomationScreen() {
    const { device_id } = useLocalSearchParams<{ device_id: string }>();
    const queryClient = useQueryClient();

    const [dailyLimit, setDailyLimit] = useState('');
    const [monthlyLimit, setMonthlyLimit] = useState('');
    const [autoCutoff, setAutoCutoff] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState('');
    const [isAddingTimer, setIsAddingTimer] = useState(false);
    const [editingTimerId, setEditingTimerId] = useState<number | null>(null);
    const [timerName, setTimerName] = useState('');
    const [timerTime, setTimerTime] = useState('');
    const [timerAction, setTimerAction] = useState<'ON' | 'OFF'>('ON');
    const [timerFormError, setTimerFormError] = useState('');
    const [timerDeleteError, setTimerDeleteError] = useState('');

    const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

    const { data: devices = [] } = useQuery({
        queryKey: ['devices'],
        queryFn: listDevices,
        staleTime: Infinity,
    });
    const device = devices.find((d) => d.device_id === device_id);

    useEffect(() => {
        if (!device) return;
        setDailyLimit(device.daily_limit_kwh != null ? String(device.daily_limit_kwh) : '');
        setMonthlyLimit(device.monthly_limit_kwh != null ? String(device.monthly_limit_kwh) : '');
        setAutoCutoff(device.auto_cutoff_enabled);
        setSaveSuccess('');
    }, [device?.daily_limit_kwh, device?.monthly_limit_kwh, device?.auto_cutoff_enabled]);

    const { data: timers = [] } = useQuery({
        queryKey: ['timers', device_id],
        queryFn: () => listTimers(device_id),
        enabled: !!device_id,
    });

    const limitsMutation = useMutation({
        mutationFn: () => {
            const parsedDaily = dailyLimit.trim() === '' ? undefined : Number(dailyLimit);
            const parsedMonthly = monthlyLimit.trim() === '' ? undefined : Number(monthlyLimit);

            return updateDeviceLimits(device_id, {
                ...(Number.isFinite(parsedDaily as number) ? { daily_limit_kwh: parsedDaily as number } : {}),
                ...(Number.isFinite(parsedMonthly as number) ? { monthly_limit_kwh: parsedMonthly as number } : {}),
                auto_cutoff_enabled: autoCutoff,
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['devices'] });
            setSaveSuccess('Limits saved.');
        },
    });

    const resetTimerForm = () => {
        setIsAddingTimer(false);
        setEditingTimerId(null);
        setTimerName('');
        setTimerTime('');
        setTimerAction('ON');
        setTimerFormError('');
        setTimerDeleteError('');
    };

    const startEditingTimer = (timer: TimerResponse) => {
        setEditingTimerId(timer.id);
        setIsAddingTimer(true);
        setTimerName(timer.name ?? '');
        setTimerTime(timer.time);
        setTimerAction(timer.action);
        setTimerFormError('');
        setTimerDeleteError('');
    };

    const createTimerMutation = useMutation({
        mutationFn: (data: { name?: string; time: string; action: 'ON' | 'OFF' }) =>
            createTimer(device_id, data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['timers', device_id] });
            resetTimerForm();
        },
        onError: () => setTimerFormError("Couldn't save timer. Check the time format and try again."),
    });

    const updateTimerMutation = useMutation({
        mutationFn: (vars: { timerId: number; data: { name?: string; time?: string; action?: 'ON' | 'OFF'; is_enabled?: boolean } }) =>
            updateTimer(device_id, vars.timerId, vars.data),
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({ queryKey: ['timers', device_id] });
            if (variables.data.time != null || variables.data.action != null || variables.data.name !== undefined) {
                resetTimerForm();
            }
        },
        onError: () => setTimerFormError("Couldn't save timer. Check the time format and try again."),
    });

    const deleteTimerMutation = useMutation({
        mutationFn: (timerId: number) => deleteTimer(device_id, timerId),
        onSuccess: async (_data, timerId) => {
            await queryClient.invalidateQueries({ queryKey: ['timers', device_id] });
            if (editingTimerId === timerId) {
                resetTimerForm();
            }
        },
        onError: () => setTimerDeleteError("Couldn't remove timer. Please try again."),
    });

    const handleTimerSubmit = () => {
        setTimerFormError('');
        setTimerDeleteError('');
        if (!TIME_PATTERN.test(timerTime.trim())) {
            setTimerFormError('Enter a valid 24-hour time, e.g. 18:30');
            return;
        }

        const payload = {
            name: timerName.trim() || undefined,
            time: timerTime.trim(),
            action: timerAction,
        };

        if (editingTimerId != null) {
            updateTimerMutation.mutate({ timerId: editingTimerId, data: payload });
        } else {
            createTimerMutation.mutate(payload);
        }
    };

    const handleToggleTimerEnabled = (timer: TimerResponse) => {
        updateTimerMutation.mutate({ timerId: timer.id, data: { is_enabled: !timer.is_enabled } });
    };

    const handleDeleteTimer = (timer: TimerResponse) => {
        Alert.alert(
            'Delete this timer?',
            `"${timer.name || `${timer.action} at ${timer.time}`}" will be removed.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        setTimerDeleteError('');
                        deleteTimerMutation.mutate(timer.id);
                    },
                },
            ]
        );
    };

    const isTimerFormPending = createTimerMutation.isPending || updateTimerMutation.isPending;

    useEffect(() => {
        if (!saveSuccess) return;
        const timer = setTimeout(() => setSaveSuccess(''), 1800);
        return () => clearTimeout(timer);
    }, [saveSuccess]);

    return (
        <FormScreen
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-4 py-5 gap-4 pb-8"
        >
            <Card size="sm" className="w-full rounded-2xl">
                <VStack className="gap-3">
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Energy Limits
                    </Text>

                    <VStack className="gap-2">
                        <Text className="text-[13px] font-semibold text-foreground">
                            Daily limit (kWh)
                        </Text>
                        <TextInput
                            value={dailyLimit}
                            onChangeText={setDailyLimit}
                            placeholder="0.40"
                            placeholderTextColor="#a3a3a3"
                            keyboardType="numeric"
                            className="rounded-xl border border-border bg-secondary px-4 py-3 text-[15px] text-foreground"
                        />
                    </VStack>

                    <VStack className="gap-2">
                        <Text className="text-[13px] font-semibold text-foreground">
                            Monthly limit (kWh)
                        </Text>
                        <TextInput
                            value={monthlyLimit}
                            onChangeText={setMonthlyLimit}
                            placeholder="12.00"
                            placeholderTextColor="#a3a3a3"
                            keyboardType="numeric"
                            className="rounded-xl border border-border bg-secondary px-4 py-3 text-[15px] text-foreground"
                        />
                    </VStack>

                    <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3">
                        <VStack className="flex-1 gap-0.5 pr-4">
                            <Text className="text-[13px] font-semibold text-foreground">
                                Auto cutoff
                            </Text>
                            <Text className="text-[11px] text-muted-foreground">
                                Disable the relay when a limit is reached.
                            </Text>
                        </VStack>

                        <Pressable
                            onPress={() => setAutoCutoff((value) => !value)}
                            className={[
                                'rounded-2xl px-5 py-3.5 flex-row items-center gap-2',
                                autoCutoff ? 'bg-success' : 'bg-destructive',
                            ].join(' ')}
                        >
                            {autoCutoff ? (
                                <ToggleRight size={20} color="#fff" />
                            ) : (
                                <ToggleLeft size={20} color="#fff" />
                            )}
                            <Text className="text-[13px] font-bold uppercase tracking-widest text-white">
                                {autoCutoff ? 'On' : 'Off'}
                            </Text>
                        </Pressable>
                    </HStack>

                    <Pressable
                        onPress={() => limitsMutation.mutate()}
                        disabled={limitsMutation.isPending}
                        className={[
                            'items-center justify-center rounded-2xl px-5 py-3.5 active:opacity-70 disabled:opacity-60',
                            limitsMutation.isPending ? 'bg-muted' : 'bg-primary',
                        ].join(' ')}
                    >
                        <Text className="text-[13px] font-bold uppercase tracking-widest text-primary-foreground">
                            {limitsMutation.isPending ? 'Saving...' : 'Save limits'}
                        </Text>
                    </Pressable>

                    {saveSuccess ? (
                        <Text className="text-[11px] font-semibold text-emerald-600">
                            {saveSuccess}
                        </Text>
                    ) : null}
                </VStack>
            </Card>

            <Card size="sm" className="w-full rounded-2xl">
                <VStack className="gap-3">
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Timers
                    </Text>

                    {timers.length === 0 && !isAddingTimer ? (
                        <Text className="text-[13px] text-muted-foreground">
                            No timers set. Add one to automatically turn this device on or off daily.
                        </Text>
                    ) : (
                        <VStack className="gap-2">
                            {timers.map((timer) => (
                                <HStack
                                    key={timer.id}
                                    className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3"
                                >
                                    <VStack className="flex-1 gap-0.5 pr-3">
                                        <Text className="text-[13px] font-semibold text-foreground">
                                            {timer.name || `${timer.action} at ${timer.time}`}
                                        </Text>
                                        <Text className="text-[11px] text-muted-foreground">
                                            {timer.time} • Turns {timer.action}
                                            {!timer.is_enabled ? ' • Disabled' : ''}
                                        </Text>
                                    </VStack>
                                    <HStack className="items-center gap-3">
                                        <Pressable onPress={() => handleToggleTimerEnabled(timer)}>
                                            {timer.is_enabled ? (
                                                <ToggleRight size={22} color="#10b981" />
                                            ) : (
                                                <ToggleLeft size={22} color="#a3a3a3" />
                                            )}
                                        </Pressable>
                                        <Pressable onPress={() => startEditingTimer(timer)}>
                                            <Pencil size={18} color="#737373" />
                                        </Pressable>
                                        <Pressable onPress={() => handleDeleteTimer(timer)}>
                                            <Trash2 size={18} color="#E7000B" />
                                        </Pressable>
                                    </HStack>
                                </HStack>
                            ))}
                        </VStack>
                    )}

                    {timerDeleteError ? (
                        <Text className="text-[11px] font-semibold text-destructive">{timerDeleteError}</Text>
                    ) : null}

                    {isAddingTimer ? (
                        <VStack className="gap-3 rounded-xl border border-border bg-secondary p-3.5">
                            <VStack className="gap-2">
                                <Text className="text-[13px] font-semibold text-foreground">Name (optional)</Text>
                                <TextInput
                                    value={timerName}
                                    onChangeText={setTimerName}
                                    placeholder="Evening lights"
                                    placeholderTextColor="#a3a3a3"
                                    className="rounded-xl border border-border bg-card px-4 py-3 text-[15px] text-foreground"
                                />
                            </VStack>

                            <VStack className="gap-2">
                                <Text className="text-[13px] font-semibold text-foreground">Time (24-hour)</Text>
                                <TextInput
                                    value={timerTime}
                                    onChangeText={setTimerTime}
                                    placeholder="18:30"
                                    placeholderTextColor="#a3a3a3"
                                    keyboardType="numbers-and-punctuation"
                                    className="rounded-xl border border-border bg-card px-4 py-3 text-[15px] text-foreground"
                                />
                            </VStack>

                            <VStack className="gap-2">
                                <Text className="text-[13px] font-semibold text-foreground">Action</Text>
                                <HStack className="gap-2">
                                    <Pressable
                                        onPress={() => setTimerAction('ON')}
                                        className={[
                                            'flex-1 items-center justify-center rounded-xl px-4 py-3',
                                            timerAction === 'ON' ? 'bg-success' : 'border border-border bg-card',
                                        ].join(' ')}
                                    >
                                        <Text className={timerAction === 'ON' ? 'font-bold text-white' : 'text-foreground'}>
                                            Turn ON
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setTimerAction('OFF')}
                                        className={[
                                            'flex-1 items-center justify-center rounded-xl px-4 py-3',
                                            timerAction === 'OFF' ? 'bg-destructive' : 'border border-border bg-card',
                                        ].join(' ')}
                                    >
                                        <Text className={timerAction === 'OFF' ? 'font-bold text-white' : 'text-foreground'}>
                                            Turn OFF
                                        </Text>
                                    </Pressable>
                                </HStack>
                            </VStack>

                            {timerFormError ? (
                                <Text className="text-[11px] font-semibold text-destructive">{timerFormError}</Text>
                            ) : null}

                            <HStack className="gap-2">
                                <Pressable
                                    onPress={resetTimerForm}
                                    disabled={isTimerFormPending}
                                    className="flex-1 items-center justify-center rounded-2xl bg-muted px-5 py-3 disabled:opacity-60"
                                >
                                    <Text className="text-[13px] font-bold uppercase tracking-widest text-foreground">
                                        Cancel
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleTimerSubmit}
                                    disabled={isTimerFormPending || timerTime.trim() === ''}
                                    className="flex-1 items-center justify-center rounded-2xl bg-primary px-5 py-3 disabled:opacity-60"
                                >
                                    <Text className="text-[13px] font-bold uppercase tracking-widest text-primary-foreground">
                                        {isTimerFormPending
                                            ? 'Saving...'
                                            : editingTimerId != null
                                                ? 'Save Timer'
                                                : 'Add Timer'}
                                    </Text>
                                </Pressable>
                            </HStack>
                        </VStack>
                    ) : (
                        <Pressable
                            onPress={() => setIsAddingTimer(true)}
                            className="items-center justify-center rounded-2xl border border-dashed border-border px-5 py-3.5"
                        >
                            <Text className="text-[13px] font-bold text-foreground">+ Add Timer</Text>
                        </Pressable>
                    )}
                </VStack>
            </Card>
        </FormScreen>
    );
}
