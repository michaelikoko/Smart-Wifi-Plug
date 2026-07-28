import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { RangeToggle, TrendBadge, WeeklyBars, type WeeklyBarDatum } from '@/components/app-ui';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { listDevices } from '../../../api/devices-api';
import { getEnergyHistorySafe, type EnergyConsumedResponse } from '../../../api/telemetry-api';

const ANALYTICS_HISTORY_DAYS = 62;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return isoDate(date);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function sumRange(rows: EnergyConsumedResponse[], startInclusive: string, endInclusive: string) {
  const inRange = rows.filter((row) => row.date >= startInclusive && row.date <= endInclusive);
  const kwh = inRange.reduce((sum, row) => sum + row.kwh_consumed, 0);
  const hasCost = inRange.some((row) => row.estimated_cost != null);
  const cost = hasCost ? inRange.reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0) : null;
  return { kwh, cost };
}

function sumMonth(rows: EnergyConsumedResponse[], monthsAgo: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - monthsAgo);
  const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const inMonth = rows.filter((row) => monthKey(row.date) === key);
  const kwh = inMonth.reduce((sum, row) => sum + row.kwh_consumed, 0);
  const hasCost = inMonth.some((row) => row.estimated_cost != null);
  const cost = hasCost ? inMonth.reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0) : null;
  return { kwh, cost };
}

function bucketMonthIntoWeeks(rows: EnergyConsumedResponse[]): WeeklyBarDatum[] {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthRows = rows.filter((row) => monthKey(row.date) === monthKey(isoDate(now)));
  const buckets: WeeklyBarDatum[] = [];
  let bucketStart = new Date(monthStart);
  let weekNumber = 1;

  while (bucketStart <= now) {
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6);
    const startStr = isoDate(bucketStart);
    const endStr = isoDate(bucketEnd) < isoDate(now) ? isoDate(bucketEnd) : isoDate(now);
    const { kwh, cost } = sumRange(monthRows, startStr, endStr);

    buckets.push({
      day: `W${weekNumber}`,
      date: endStr,
      kwh,
      costKobo: cost,
      label: `W${weekNumber}`,
    });

    bucketStart.setUTCDate(bucketStart.getUTCDate() + 7);
    weekNumber += 1;
  }

  return buckets;
}

export default function DeviceAnalyticsScreen() {
  const { device_id } = useLocalSearchParams<{ device_id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly');

  const { data: devices = [], refetch: refetchDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    staleTime: Infinity,
  });

  const device = devices.find((item) => item.device_id === device_id);

  const { data: rows = [], isRefetching, refetch } = useQuery({
    queryKey: ['analytics-history', device_id],
    queryFn: () => getEnergyHistorySafe(device_id, ANALYTICS_HISTORY_DAYS),
    enabled: !!device_id,
    staleTime: 5 * 60_000,
  });

  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'analytics-history' && query.queryKey[1] === device_id,
    });
    await Promise.all([refetchDevices(), refetch()]);
  };

  const currentRange = range === 'weekly'
    ? sumRange(rows, daysAgo(6), daysAgo(0))
    : sumMonth(rows, 0);
  const previousRange = range === 'weekly'
    ? sumRange(rows, daysAgo(13), daysAgo(7))
    : sumMonth(rows, 1);

  const chartData: WeeklyBarDatum[] = range === 'weekly'
    ? Array.from({ length: 7 }, (_, index) => {
        const date = daysAgo(6 - index);
        const row = rows.find((entry) => entry.date === date);
        const dayDate = new Date(`${date}T00:00:00Z`);

        return {
          day: dayDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
          date,
          kwh: row?.kwh_consumed ?? 0,
          costKobo: row?.estimated_cost ?? null,
        };
      })
    : bucketMonthIntoWeeks(rows);

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
        <RangeToggle value={range} onChange={setRange} />

        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Device Overview - {range === 'weekly' ? 'This Week' : 'This Month'}
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
            title={range === 'weekly' ? 'Weekly Consumption - Device' : 'Monthly Consumption - Device'}
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