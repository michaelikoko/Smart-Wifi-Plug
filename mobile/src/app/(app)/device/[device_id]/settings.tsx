import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { FormScreen } from '@/components/app-ui';

import { deleteDevice } from '../../../../api/devices-api';
import { publishWifiChangeCommand, unsubscribeFromDevice } from '../../../../lib/mqtt-client';
import { useDeviceStateStore } from '../../../../store/device-state-store';

export default function DeviceSettingsScreen() {
    const { device_id } = useLocalSearchParams<{ device_id: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();

    const liveState = useDeviceStateStore((s) => s.devices[device_id]);
    const isOnline = liveState?.isOnline ?? null;

    const [wifiSsid, setWifiSsid] = useState('');
    const [wifiPassword, setWifiPassword] = useState('');
    const [wifiStatus, setWifiStatus] = useState<'idle' | 'pending' | 'success' | 'failed' | 'timeout'>('idle');
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        if (wifiStatus !== 'success') return;
        const t = setTimeout(() => setWifiStatus('idle'), 3000);
        return () => clearTimeout(t);
    }, [wifiStatus]);

    const wifiMutation = useMutation({
        mutationFn: () => publishWifiChangeCommand(device_id, wifiSsid.trim(), wifiPassword),
        onMutate: () => setWifiStatus('pending'),
        onSuccess: (res) => {
            if (res.status === 'success') {
                setWifiSsid('');
                setWifiPassword('');
                setWifiStatus('success');
            } else if (res.status === 'failed') {
                setWifiStatus('failed');
            } else {
                setWifiStatus('timeout');
            }
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteDevice(device_id),
        onSuccess: async () => {
            unsubscribeFromDevice(device_id);
            await queryClient.invalidateQueries({ queryKey: ['devices'] });
            router.replace('/(app)/devices');
        },
        onError: () => {
            setDeleteError('Couldn\'t remove device. Please try again.');
        },
    });

    return (
        <FormScreen
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-4 py-5 gap-4 pb-8"
        >
            <Card size="sm" className="w-full rounded-2xl">
                <VStack className="gap-3">
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Network
                    </Text>

                    <VStack className="gap-2">
                        <Text className="text-[13px] font-semibold text-foreground">New WiFi Network Name</Text>
                        <TextInput
                            value={wifiSsid}
                            onChangeText={setWifiSsid}
                            placeholder="SSID"
                            placeholderTextColor="#a3a3a3"
                            autoCapitalize="none"
                            autoCorrect={false}
                            className="rounded-xl border border-border bg-secondary px-4 py-3 text-[15px] text-foreground"
                        />
                    </VStack>

                    <VStack className="gap-2">
                        <Text className="text-[13px] font-semibold text-foreground">New WiFi Password</Text>
                        <TextInput
                            value={wifiPassword}
                            onChangeText={setWifiPassword}
                            placeholder="Password"
                            placeholderTextColor="#a3a3a3"
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            className="rounded-xl border border-border bg-secondary px-4 py-3 text-[15px] text-foreground"
                        />
                    </VStack>

                    <Pressable
                        onPress={() => wifiMutation.mutate()}
                        disabled={
                            wifiStatus === 'pending' ||
                            wifiSsid.trim() === '' ||
                            wifiPassword.trim() === '' ||
                            !isOnline
                        }
                        className={[
                            'items-center justify-center rounded-2xl px-5 py-3.5 active:opacity-70 disabled:opacity-60',
                            wifiStatus === 'pending' ? 'bg-muted' : 'bg-primary',
                        ].join(' ')}
                    >
                        <Text className="text-[13px] font-bold uppercase tracking-widest text-primary-foreground">
                            {wifiStatus === 'pending' ? 'Updating...' : 'Update WiFi'}
                        </Text>
                    </Pressable>

                    {wifiStatus === 'pending' ? (
                        <Text className="text-[11px] text-muted-foreground">Updating... the plug will briefly reconnect.</Text>
                    ) : wifiStatus === 'success' ? (
                        <Text className="text-[11px] font-semibold text-emerald-600">WiFi updated.</Text>
                    ) : wifiStatus === 'failed' ? (
                        <Text className="text-[11px] font-semibold text-destructive">Couldn&apos;t connect with those details. The plug is still on its previous network.</Text>
                    ) : wifiStatus === 'timeout' ? (
                        <Text className="text-[11px] text-muted-foreground">No confirmation received. Check the plug&apos;s connection or try again.</Text>
                    ) : null}
                </VStack>
            </Card>

            <Card size="sm" className="w-full rounded-2xl border-destructive bg-destructive/10">
                <VStack className="gap-3">
                    <Text className="text-[12px] text-destructive/80">
                        Removing this device unregisters it from your account. If it&apos;s still powered on, it will continue running with its current WiFi settings until reset or re-registered.
                    </Text>

                    <Pressable
                        onPress={() => {
                            Alert.alert(
                                'Remove this device?',
                                'This action cannot be undone from the app. You would need to register the device again to regain control. The device itself will not be affected if it remains powered on.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Remove',
                                        style: 'destructive',
                                        onPress: () => {
                                            setDeleteError('');
                                            deleteMutation.mutate();
                                        },
                                    },
                                ]
                            );
                        }}
                        disabled={deleteMutation.isPending}
                        className={[
                            'items-center justify-center rounded-2xl px-5 py-3.5 active:opacity-70 disabled:opacity-60',
                            deleteMutation.isPending ? 'bg-muted' : 'bg-destructive',
                        ].join(' ')}
                    >
                        <Text className="text-[13px] font-bold uppercase tracking-widest text-white">
                            {deleteMutation.isPending ? 'Removing...' : 'Remove Device'}
                        </Text>
                    </Pressable>

                    {deleteError ? (
                        <Text className="text-[11px] font-semibold text-destructive">
                            {deleteError}
                        </Text>
                    ) : null}
                </VStack>
            </Card>
        </FormScreen>
    );
}
