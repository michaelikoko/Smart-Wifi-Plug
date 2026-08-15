import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, RefreshCcw, WifiOff } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  listEvents,
  markAllEventsRead,
  markEventRead,
  type EnergyEventResponse,
} from '../../api/events-api';
import { useDeviceStateStore } from '../../store/device-state-store';

function isDailyEvent(event: EnergyEventResponse): boolean {
  return event.period === 'daily' || event.event_type.toLowerCase().includes('daily');
}

function EventRow({
  event,
  onPress,
  disabled,
}: {
  event: EnergyEventResponse;
  onPress: () => void;
  disabled: boolean;
}) {
  const isDaily = isDailyEvent(event);
  const iconColor = isDaily ? '#2563eb' : '#f59e0b';

  return (
    <Pressable onPress={onPress} disabled={disabled} className="active:opacity-70">
      <Card size="sm" className="w-full rounded-2xl">
        <HStack className="items-start gap-3">
          <View className="mt-3 h-2.5 w-2.5 rounded-full bg-destructive" style={{ opacity: event.is_read ? 0 : 1 }} />

          <View className="h-11 w-11 items-center justify-center rounded-xl bg-secondary">
            <Bell size={18} color={iconColor} />
          </View>

          <VStack className="flex-1 gap-1">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {isDaily ? 'Daily limit reached' : 'Monthly limit reached'}
            </Text>
            <Text className="text-[15px] font-bold text-foreground">
              {event.period_key}
            </Text>
            <Text className="text-[13px] text-muted-foreground">
              {event.kwh_at_event.toFixed(2)} kWh / {event.limit_kwh.toFixed(2)} kWh limit
            </Text>
          </VStack>
        </HStack>
      </Card>
    </Pressable>
  );
}

export default function AlertsScreen() {
  const queryClient = useQueryClient();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const { data: eventList, isLoading, isRefetching, isError, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: () => listEvents()
  });

  const events = eventList?.events ?? [];
  const displayedEvents = showUnreadOnly ? events.filter((event) => !event.is_read) : events;
  const isInitialLoading = isLoading && !eventList;

  const markReadMutation = useMutation({
    mutationFn: markEventRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllEventsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      const { clearUnreadEvents, devices } = useDeviceStateStore.getState();
      Object.keys(devices).forEach((deviceId) => clearUnreadEvents(deviceId));
    },
  });

  const onRefresh = async () => {
    await queryClient.refetchQueries({ queryKey: ['events'] });
  };

  return (
    <View className="flex-1 bg-secondary dark:bg-background">
      <View className="border-b border-border bg-card px-5 pb-4 pt-14">
        <HStack className="items-start justify-between gap-4">
          <VStack className="flex-1 gap-1">
            <Heading size="lg" className="text-foreground">
              Alerts
            </Heading>
            <Text className="text-[13px] text-muted-foreground">
              Energy limit notifications from your devices.
            </Text>
          </VStack>

          <Pressable
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || events.length === 0}
            className="flex-row items-center gap-2 rounded-2xl bg-secondary px-4 py-3 active:opacity-70 disabled:opacity-50"
          >
            {markAllReadMutation.isPending ? (
              <Spinner size="small" />
            ) : (
              <CheckCheck size={16} color="#171717" />
            )}
            <Text className="text-[12px] font-bold uppercase tracking-widest text-foreground">
              Mark all read
            </Text>
          </Pressable>
        </HStack>
      </View>

      <View className="flex-1 px-4 py-5 gap-4 pb-8">
        <Card size="sm" className="w-full rounded-2xl p-2">
          <HStack className="items-center gap-2 rounded-2xl border border-border bg-secondary p-1.5">
            <Pressable
              onPress={() => setShowUnreadOnly(false)}
              className={[
                'flex-1 items-center justify-center rounded-2xl px-4 py-2.5',
                !showUnreadOnly ? 'bg-card border border-border' : 'bg-transparent',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-[13px] font-bold uppercase tracking-widest',
                  !showUnreadOnly ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                All
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowUnreadOnly(true)}
              className={[
                'flex-1 items-center justify-center rounded-2xl px-4 py-2.5',
                showUnreadOnly ? 'bg-card border border-border' : 'bg-transparent',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-[13px] font-bold uppercase tracking-widest',
                  showUnreadOnly ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                Unread
              </Text>
            </Pressable>
          </HStack>
        </Card>

        {isError && !eventList ? (
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
                  Unable to load your alerts. Please check your internet and try again.
                </Text>
              </VStack>
              <Pressable
                onPress={() => refetch()}
                className="mt-2 flex-row items-center gap-2 rounded-xl bg-secondary px-5 py-3 active:opacity-70"
              >
                <RefreshCcw size={16} color="#171717" />
                <Text className="text-[13px] font-bold uppercase tracking-widest text-foreground">
                  Retry
                </Text>
              </Pressable>
            </VStack>
          </Card>
        ) : (
          <FlatList
            data={displayedEvents}
            keyExtractor={(item) => String(item.id)}
            className="flex-1"
            showsVerticalScrollIndicator={false}
            refreshing={isRefetching}
            onRefresh={onRefresh}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={onRefresh}
                tintColor="#171717"
                colors={['#171717']}
                progressBackgroundColor="#ffffff"
              />
            }
            contentContainerClassName="gap-3 pb-8"
            ListEmptyComponent={(
              <Card size="sm" className="w-full items-center rounded-2xl py-10">
                <VStack className="items-center gap-3">
                  {isInitialLoading ? (
                    <Spinner size="large" />
                  ) : (
                    <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                      <Bell size={28} color="#737373" />
                    </View>
                  )}
                  <VStack className="items-center gap-1.5">
                    <Heading size="md" className="text-center text-foreground">
                      {isInitialLoading ? 'Loading alerts' : 'No alerts'}
                    </Heading>
                    {!isInitialLoading ? (
                      <Text className="max-w-64 text-center text-sm text-muted-foreground">
                        When a device crosses its energy limit, it will appear here.
                      </Text>
                    ) : null}
                  </VStack>
                </VStack>
              </Card>
            )}
            renderItem={({ item }) => (
              <EventRow
                event={item}
                disabled={markReadMutation.isPending}
                onPress={() => {
                  if (!item.is_read) {
                    markReadMutation.mutate(item.id);
                  }
                }}
              />
            )}
          />
        )}
      </View>
    </View>
  );
}
