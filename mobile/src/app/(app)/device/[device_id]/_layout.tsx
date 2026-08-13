import { useQuery } from '@tanstack/react-query';
import { Slot, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { listDevices } from '../../../../api/devices-api';
import { useDeviceStateStore } from '../../../../store/device-state-store';

type DeviceTab = 'overview' | 'automation' | 'settings';

export default function DeviceDetailLayout() {
  const { device_id } = useLocalSearchParams<{ device_id: string }>();
  const router = useRouter();
  const pathname = usePathname();

  const liveState = useDeviceStateStore((s) => s.devices[device_id]);
  const isOnline = liveState?.isOnline ?? null;

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    staleTime: Infinity,
  });

  const device = devices.find((d) => d.device_id === device_id);

  const activeTab: DeviceTab = pathname.endsWith('/automation')
    ? 'automation'
    : pathname.endsWith('/settings')
      ? 'settings'
      : 'overview';

  const handleTabPress = (tab: DeviceTab) => {
    if (tab === 'overview') {
      router.replace({ pathname: '/(app)/device/[device_id]', params: { device_id } });
    } else {
      router.replace({ pathname: `/(app)/device/[device_id]/${tab}`, params: { device_id } });
    }
  };

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
            <Badge className={`rounded-full ${isOnline ? 'bg-success' : 'bg-destructive'}`}>
              <BadgeText>{isOnline ? 'Online' : 'Offline'}</BadgeText>
            </Badge>
          )}
        </HStack>
      </View>

      <View className="mx-4 my-4 rounded-2xl border border-border bg-secondary p-1">
        <HStack className="gap-2">
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'automation', label: 'Automation' },
            { key: 'settings', label: 'Settings' },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                className={[
                  'flex-1 items-center justify-center rounded-xl px-4 py-3',
                  isActive ? 'bg-primary' : 'border border-border bg-card',
                ].join(' ')}
              >
                <Text className={isActive ? 'text-[13px] font-bold text-primary-foreground' : 'text-[13px] font-semibold text-foreground'}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      </View>

      <View className="flex-1">
        <Slot />
      </View>
    </View>
  );
}
