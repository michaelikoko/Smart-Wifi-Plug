import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronRight, TrendingUp } from 'lucide-react-native';
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

export default function AnalyticsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly');

  const { data: devices = [], isLoading: isLoadingDevices, refetch: refetchDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    staleTime: Infinity,
  });

  const historyQueries = useQueries({
    queries: devices.map((device) => ({
      queryKey: ['analytics-history', device.device_id],
      queryFn: () => getEnergyHistorySafe(device.device_id, ANALYTICS_HISTORY_DAYS),
      enabled: !!device.device_id,
      staleTime: 5 * 60_000,
    })),
  });

  const isLoadingHistory = historyQueries.some((query) => query.isLoading);
  const isRefetching = isLoadingDevices || isLoadingHistory;

  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'analytics-history',
    });
    await refetchDevices();
  };

  const perDevice = devices.map((device, index) => {
    const rows = historyQueries[index]?.data ?? [];
    const rowsByDate = new Map(rows.map((row) => [row.date, row]));
    const currentRange = range === 'weekly'
      ? sumRange(rows, daysAgo(6), daysAgo(0))
      : sumMonth(rows, 0);
    const previousRange = range === 'weekly'
      ? sumRange(rows, daysAgo(13), daysAgo(7))
      : sumMonth(rows, 1);

    return { device, rows, rowsByDate, currentRange, previousRange };
  });

  const fleetCurrentKwh = perDevice.reduce((sum, item) => sum + item.currentRange.kwh, 0);
  const fleetPreviousKwh = perDevice.reduce((sum, item) => sum + item.previousRange.kwh, 0);
  const anyDeviceHasCost = perDevice.some((item) => item.currentRange.cost != null);
  const fleetCurrentCost = anyDeviceHasCost
    ? perDevice.reduce((sum, item) => sum + (item.currentRange.cost ?? 0), 0)
    : null;

  const ranked = [...perDevice].sort((a, b) => b.currentRange.kwh - a.currentRange.kwh);

  const fleetChartData: WeeklyBarDatum[] = range === 'weekly'
    ? (devices.length === 0 ? [] : Array.from({ length: 7 }, (_, index) => {
        const date = daysAgo(6 - index);
        const kwh = perDevice.reduce((sum, item) => sum + (item.rowsByDate.get(date)?.kwh_consumed ?? 0), 0);
        const hasCost = perDevice.some((item) => item.rowsByDate.get(date)?.estimated_cost != null);
        const cost = hasCost
          ? perDevice.reduce((sum, item) => sum + (item.rowsByDate.get(date)?.estimated_cost ?? 0), 0)
          : null;
        const dayDate = new Date(`${date}T00:00:00Z`);

        return {
          day: dayDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
          date,
          kwh,
          costKobo: cost,
        };
      }))
    : (() => {
        const perDeviceBuckets = perDevice.map((item) => bucketMonthIntoWeeks(item.rows));
        const bucketCount = Math.max(0, ...perDeviceBuckets.map((buckets) => buckets.length));
        if (bucketCount === 0) return [];

        return Array.from({ length: bucketCount }, (_, index) => {
          const kwh = perDeviceBuckets.reduce((sum, buckets) => sum + (buckets[index]?.kwh ?? 0), 0);
          const hasCost = perDeviceBuckets.some((buckets) => buckets[index]?.costKobo != null);
          const cost = hasCost
            ? perDeviceBuckets.reduce((sum, buckets) => sum + (buckets[index]?.costKobo ?? 0), 0)
            : null;

          return {
            day: `W${index + 1}`,
            date: perDeviceBuckets.find((buckets) => buckets[index])?.[index]?.date ?? '',
            kwh,
            costKobo: cost,
            label: `W${index + 1}`,
          };
        });
      })();

  return (
    <View className="flex-1 bg-secondary dark:bg-background">
      <View className="border-b border-border bg-card px-5 pb-4 pt-14">
        <HStack className="items-center gap-3">
          <VStack className="flex-1 gap-0">
            <Heading size="lg" className="text-foreground">Analytics</Heading>
            <Text className="text-[11px] text-muted-foreground">Usage and cost across your fleet</Text>
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
            <HStack className="items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Fleet Overview - {range === 'weekly' ? 'This Week' : 'This Month'}
              </Text>
              <TrendingUp size={16} color="#737373" />
            </HStack>

            <HStack className="gap-3">
              <VStack className="flex-1 gap-1 rounded-xl border border-border bg-secondary p-3">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Energy</Text>
                <Text className="text-2xl font-black text-foreground">{fleetCurrentKwh.toFixed(2)}</Text>
                <Text className="text-[11px] text-muted-foreground">kWh</Text>
              </VStack>
              <VStack className="flex-1 gap-1 rounded-xl border border-border bg-secondary p-3">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cost</Text>
                <Text className="text-2xl font-black text-foreground">
                  {fleetCurrentCost != null ? `₦${(fleetCurrentCost / 100).toFixed(2)}` : '—'}
                </Text>
                {fleetCurrentCost == null ? (
                  <Pressable onPress={() => router.push('/(app)/profile')}>
                    <Text className="text-[10px] font-semibold text-primary underline">Set billing rate</Text>
                  </Pressable>
                ) : (
                  <Text className="text-[11px] text-muted-foreground">Estimated from current period</Text>
                )}
              </VStack>
            </HStack>

            <TrendBadge current={fleetCurrentKwh} previous={fleetPreviousKwh} />
          </VStack>
        </Card>

        <Card size="sm" className="w-full rounded-2xl">
          <WeeklyBars
            data={fleetChartData}
            title={range === 'weekly' ? 'Weekly Consumption - Fleet' : 'Monthly Consumption - Fleet'}
          />
        </Card>

        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Device Ranking
            </Text>
            {ranked.length === 0 ? (
              <Text className="text-[13px] text-muted-foreground">No devices yet.</Text>
            ) : (
              ranked.map(({ device, currentRange }) => {
                const share = fleetCurrentKwh > 0 ? (currentRange.kwh / fleetCurrentKwh) * 100 : 0;

                return (
                  <Pressable
                    key={device.device_id}
                    onPress={() => router.push(`/(app)/analytics/${device.device_id}`)}
                  >
                    <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3">
                      <VStack className="flex-1 gap-0.5 pr-3">
                        <Text className="text-[13px] font-semibold text-foreground">{device.name}</Text>
                        <Text className="text-[11px] text-muted-foreground">
                          {currentRange.kwh.toFixed(2)} kWh · {share.toFixed(0)}% of fleet
                        </Text>
                      </VStack>
                      <ChevronRight size={16} color="#9ca3af" />
                    </HStack>
                  </Pressable>
                );
              })
            )}
          </VStack>
        </Card>
      </ScrollView>
    </View>
  );
}