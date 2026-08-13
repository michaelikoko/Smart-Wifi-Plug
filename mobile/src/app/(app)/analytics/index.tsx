import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronRight, TrendingUp } from 'lucide-react-native';
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

export default function AnalyticsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('weekly');
  const { start, end } = monthKeyBounds(monthKey);
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const { start: prevStart, end: prevEnd } = monthKeyBounds(prevMonthKey);

  const { data: devices = [], isLoading: isLoadingDevices, refetch: refetchDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    staleTime: Infinity,
  });

  const historyQueries = useQueries({
    queries: devices.flatMap((device) => [
      {
        queryKey: ['analytics-history-range', device.device_id, start, end],
        queryFn: () => getEnergyHistoryRangeSafe(device.device_id, start, end),
        enabled: !!device.device_id,
        staleTime: 5 * 60_000,
      },
      {
        queryKey: ['analytics-history-range', device.device_id, prevStart, prevEnd],
        queryFn: () => getEnergyHistoryRangeSafe(device.device_id, prevStart, prevEnd),
        enabled: !!device.device_id,
        staleTime: 5 * 60_000,
      },
    ]),
  });

  const isLoadingHistory = historyQueries.some((query) => query.isLoading);
  const isRefetching = isLoadingDevices || isLoadingHistory;

  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'analytics-history-range',
    });
    await refetchDevices();
  };

  const perDevice = devices.map((device, index) => {
    const currentMonthRows = historyQueries[index * 2]?.data ?? [];
    const prevMonthRows = historyQueries[index * 2 + 1]?.data ?? [];
    const currentRange = sumRows(currentMonthRows);
    const previousRange = sumRows(prevMonthRows);

    return { device, currentMonthRows, prevMonthRows, currentRange, previousRange };
  });

  const fleetCurrentKwh = perDevice.reduce((sum, item) => sum + item.currentRange.kwh, 0);
  const fleetPreviousKwh = perDevice.reduce((sum, item) => sum + item.previousRange.kwh, 0);
  const devicesWithCost = perDevice.filter((item) => item.currentRange.cost != null);
  const devicesMissingCost = perDevice.length - devicesWithCost.length;
  const fleetCurrentCost = devicesWithCost.length > 0
    ? devicesWithCost.reduce((sum, item) => sum + (item.currentRange.cost ?? 0), 0)
    : null;

  const ranked = [...perDevice].sort((a, b) => b.currentRange.kwh - a.currentRange.kwh);

  const fleetChartData: WeeklyBarDatum[] = (() => {
    const bucketer = granularity === 'daily' ? bucketMonthIntoDays : bucketMonthIntoWeeks;
    const perDeviceBuckets = perDevice.map((item) => bucketer(item.currentMonthRows, monthKey));
    const bucketCount = Math.max(0, ...perDeviceBuckets.map((buckets) => buckets.length));
    if (bucketCount === 0) return [];

    return Array.from({ length: bucketCount }, (_, index) => {
      const kwh = perDeviceBuckets.reduce((sum, buckets) => sum + (buckets[index]?.kwh ?? 0), 0);
      const hasCost = perDeviceBuckets.some((buckets) => buckets[index]?.costKobo != null);
      const cost = hasCost
        ? perDeviceBuckets.reduce((sum, buckets) => sum + (buckets[index]?.costKobo ?? 0), 0)
        : null;
     const sample = perDeviceBuckets.find((buckets) => buckets[index])?.[index];

      return {
       day: sample?.day ?? `W${index + 1}`,
       date: sample?.date ?? '',
        kwh,
        costKobo: cost,
       label: sample?.label,
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
        <MonthPicker
          monthKey={monthKey}
          onPrev={() => setMonthKey(shiftMonthKey(monthKey, -1))}
          onNext={() => setMonthKey(shiftMonthKey(monthKey, 1))}
          canGoNext={monthKey !== currentMonthKey()}
        />
        <ChartGranularityToggle value={granularity} onChange={setGranularity} />

        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <HStack className="items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Fleet Overview - {formatMonthLabel(monthKey)}
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
                ) : devicesMissingCost > 0 ? (
                  <Text className="text-[11px] text-muted-foreground">
                    Excludes {devicesMissingCost} device{devicesMissingCost > 1 ? 's' : ''} without a billing rate
                  </Text>
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
            title={`${formatMonthLabel(monthKey)} ${granularity === 'daily' ? 'Daily' : 'Weekly'} Consumption - Fleet`}
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
