import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ChartGranularityToggle, MonthPicker, TrendBadge, WeeklyBars, type WeeklyBarDatum } from '@/components/app-ui';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { listDevices } from '../../../api/devices-api';
import { getEnergyHistoryRangeSafe } from '../../../api/telemetry-api';
import {
  bucketMonthIntoDays,
  bucketMonthIntoWeeks,
  currentMonthKey,
  formatMonthLabel,
  monthKeyBounds,
  shiftMonthKey,
  sumRows,
} from './_utils';

export default function DeviceAnalyticsScreen() {
  const { device_id } = useLocalSearchParams<{ device_id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('weekly');
  const { start, end } = monthKeyBounds(monthKey);
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const { start: prevStart, end: prevEnd } = monthKeyBounds(prevMonthKey);

  const { data: devices = [], isRefetching: isRefetchingDevices, refetch: refetchDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    staleTime: Infinity,
  });

  const device = devices.find((item) => item.device_id === device_id);

  const currentHistoryQuery = useQuery({
    queryKey: ['analytics-history-range', device_id, start, end],
    queryFn: () => getEnergyHistoryRangeSafe(device_id, start, end),
    enabled: !!device_id,
    staleTime: 5 * 60_000,
  });

  const previousHistoryQuery = useQuery({
    queryKey: ['analytics-history-range', device_id, prevStart, prevEnd],
    queryFn: () => getEnergyHistoryRangeSafe(device_id, prevStart, prevEnd),
    enabled: !!device_id,
    staleTime: 5 * 60_000,
  });

  const rows = currentHistoryQuery.data ?? [];
  const prevRows = previousHistoryQuery.data ?? [];
  const isRefetching = isRefetchingDevices || currentHistoryQuery.isRefetching || previousHistoryQuery.isRefetching;

  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'analytics-history-range' && query.queryKey[1] === device_id,
    });
    await Promise.all([refetchDevices(), currentHistoryQuery.refetch(), previousHistoryQuery.refetch()]);
  };

  const currentRange = sumRows(rows);
  const previousRange = sumRows(prevRows);

  const bucketer = granularity === 'daily' ? bucketMonthIntoDays : bucketMonthIntoWeeks;
  const chartData: WeeklyBarDatum[] = bucketer(rows, monthKey);

  const peakDay = rows.length > 0
    ? rows.reduce((max, row) => (row.kwh_consumed > max.kwh_consumed ? row : max), rows[0])
    : null;

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
            <Heading size="lg" className="text-foreground">{device?.name ?? device_id}</Heading>
            <Text className="text-[11px] text-muted-foreground">Analytics</Text>
          </VStack>
          <TrendingUp size={18} color="#171717" />
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
        <MonthPicker
          monthKey={monthKey}
          onPrev={() => setMonthKey(shiftMonthKey(monthKey, -1))}
          onNext={() => setMonthKey(shiftMonthKey(monthKey, 1))}
          canGoNext={monthKey !== currentMonthKey()}
        />
        <ChartGranularityToggle value={granularity} onChange={setGranularity} />

        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Device Overview - {formatMonthLabel(monthKey)}
            </Text>

            <HStack className="gap-3">
              <VStack className="flex-1 gap-1 rounded-xl border border-border bg-secondary p-3">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Energy</Text>
                <Text className="text-2xl font-black text-foreground">{currentRange.kwh.toFixed(2)}</Text>
                <Text className="text-[11px] text-muted-foreground">kWh</Text>
              </VStack>
              <VStack className="flex-1 gap-1 rounded-xl border border-border bg-secondary p-3">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cost</Text>
                <Text className="text-2xl font-black text-foreground">
                  {currentRange.cost != null ? `₦${(currentRange.cost / 100).toFixed(2)}` : '—'}
                </Text>
                {currentRange.cost == null ? (
                  <Pressable onPress={() => router.push('/(app)/profile')}>
                    <Text className="text-[10px] font-semibold text-primary underline">Set billing rate</Text>
                  </Pressable>
                ) : (
                  <Text className="text-[11px] text-muted-foreground">Estimated from current period</Text>
                )}
              </VStack>
            </HStack>

            <TrendBadge current={currentRange.kwh} previous={previousRange.kwh} />
          </VStack>
        </Card>

        <Card size="sm" className="w-full rounded-2xl">
          <WeeklyBars
            data={chartData}
            title={`${formatMonthLabel(monthKey)} ${granularity === 'daily' ? 'Daily' : 'Weekly'} Consumption - Device`}
          />
        </Card>

        {peakDay && (
          <Card size="sm" className="w-full rounded-2xl">
            <HStack className="items-center gap-3">
              <TrendingUp size={18} color="#171717" />
              <VStack className="flex-1 gap-0.5">
                <Text className="text-[13px] font-bold text-foreground">Peak day</Text>
                <Text className="text-[11px] text-muted-foreground">
                  {new Date(`${peakDay.date}T00:00:00Z`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                  {' - '}{peakDay.kwh_consumed.toFixed(3)} kWh
                </Text>
              </VStack>
            </HStack>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
