import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRef } from 'react';
import { Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Spinner } from './ui/spinner';


export function OtpInput({
  length = 6,
  value,
  onChange,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputs = useRef<(TextInput | null)[]>([]);

  // Ensure our ref tracking array is correctly sized on render
  if (inputs.current.length !== length) {
    inputs.current = Array(length).fill(null);
  }

  const handleChange = (text: string, index: number) => {
    // Keep only numbers and take the last typed digit
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const chars = value.split('');
    chars[index] = digit;
    const next = chars.join('');
    onChange(next);

    // Auto-focus next input box if a number was typed
    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    // Go to previous box on Backspace if current box is empty
    if (key === 'Backspace' && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <HStack className="justify-center gap-3">
      {Array.from({ length }).map((_, i) => {
        const isFocused = value.length === i || (i === length - 1 && value.length >= length);

        return (
          <View
            key={i}
            className={`h-14 w-11 items-center justify-center rounded-xl border bg-card ${isFocused ? 'border-2 border-primary' : 'border-border'
              }`}
          >
            <TextInput
              ref={(r) => {
                inputs.current[i] = r;
              }}
              value={value[i] ?? ''}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              style={{
                textAlign: 'center',
                fontSize: 20,
                fontWeight: 'bold',
                width: '100%',
                height: '100%',
              }}
              className="text-foreground"
            />
          </View>
        );
      })}
    </HStack>
  );
}


export interface WeeklyBarDatum {
  day: string;   // short label, e.g. "Mon"
  date: string;  // ISO date string "YYYY-MM-DD"
  kwh: number;   // raw kWh value for this day
  costKobo: number | null; // The cost in kobo from the backend
  label?: string; // optional pre-built label; overrides the auto day+day-of-month format below
}
const WEEKLY_COLORS = [
  '#10b981', // Emerald Green (Monday)
  '#3b82f6', // Blue (Tuesday)
  '#f59e0b', // Amber/Yellow (Wednesday)
  '#8b5cf6', // Purple (Thursday)
  '#ef4444', // Red (Friday)
  '#ec4899', // Pink (Saturday)
  '#06b6d4', // Cyan (Sunday)
];
export function WeeklyBars({ data, title = 'Weekly Consumption' }: { data: WeeklyBarDatum[]; title?: string }) {
  const { width } = useWindowDimensions();
  const hasData = data.length > 0;
  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dateStr}T00:00:00Z`));

  const rangeLabel =
    data.length >= 2
      ? `${formatDate(data[0].date)} – ${formatDate(data[data.length - 1].date)}`
      : '';

  // 1. Prepare data for the chart
  const barData = data.map((d, idx) => {
    const costValue = d.costKobo != null ? d.costKobo / 100 : 0;
    const dayOfMonth = new Date(`${d.date}T00:00:00Z`).getUTCDate();

    return {
      ...d,
      label: d.label ?? `${d.day}\n${dayOfMonth}`,
      value: d.kwh,
      costFormatted: costValue > 0 ? `₦${costValue.toFixed(2)}` : '₦0.00',
      frontColor: WEEKLY_COLORS[idx % WEEKLY_COLORS.length],
    };
  });

  const maxKwh = hasData ? Math.max(...barData.map((d) => d.value), 0.001) : 1;

  return (
    <VStack className="gap-3">
      <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </Text>
      {rangeLabel ? (
        <Text className="text-[11px] font-semibold text-muted-foreground">
          {rangeLabel}
        </Text>
      ) : null}

      <View className="rounded-xl border border-border bg-secondary p-4">
        {hasData ? (
          <BarChart
            data={barData}
            height={150}
            // Make the chart responsive to the card width (padding buffer)
            width={width - 110}
            barWidth={22}
            spacing={14}
            roundedTop
            hideRules
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: '#737373', fontSize: 10 }}
            xAxisLabelTextStyle={{ color: '#737373', fontSize: 9, textAlign: 'center' }}
            xAxisLabelsVerticalShift={5}
            maxValue={maxKwh}
            noOfSections={4}
            yAxisExtraHeight={50}
            renderTooltip={(item: any) => {
              return (
                <View className="mb-2 items-center justify-center rounded-md bg-foreground px-2 py-1 shadow-lg">
                  <Text className="text-[10px] font-bold text-background">
                    {formatDate(item.date)} · {item.value.toFixed(2)} kWh
                  </Text>
                  <Text className="text-[9px] text-muted">
                    {item.costFormatted}
                  </Text>
                </View>
              );
            }}
          />
        ) : (
          <View className="h-37.5 items-center justify-center">
            <Text className="text-center text-[11px] text-muted-foreground">
              No consumption data yet
            </Text>
          </View>
        )}
      </View>
    </VStack>
  );
}


export function RangeToggle({
  value,
  onChange,
}: {
  value: 'weekly' | 'monthly';
  onChange: (v: 'weekly' | 'monthly') => void;
}) {
  return (
    <HStack className="gap-2 rounded-xl bg-secondary p-1">
      {(['weekly', 'monthly'] as const).map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          className={[
            'flex-1 items-center justify-center rounded-lg py-2',
            value === option ? 'bg-card' : '',
          ].join(' ')}
        >
          <Text
            className={[
              'text-[12px] font-bold uppercase tracking-widest',
              value === option ? 'text-foreground' : 'text-muted-foreground',
            ].join(' ')}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </HStack>
  );
}


export function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) return null; // nothing meaningful to compare against
  const pctChange = ((current - previous) / previous) * 100;
  const isUp = pctChange > 0;
  const isFlat = Math.abs(pctChange) < 0.5;

  if (isFlat) {
    return <Text className="text-[11px] font-semibold text-muted-foreground">No change</Text>;
  }

  return (
    <Text className={`text-[11px] font-semibold ${isUp ? 'text-destructive' : 'text-emerald-600'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(pctChange).toFixed(0)}% vs. previous period
    </Text>
  );
}


export function MetricCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <VStack className="flex-1 gap-1.5 rounded-xl border border-border bg-secondary p-4">
      <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
      <HStack className="items-end gap-1">
        <Text className="text-3xl font-black text-foreground">{value}</Text>
        {unit ? (
          <Text className="mb-0.5 text-sm font-semibold text-muted-foreground">{unit}</Text>
        ) : null}
      </HStack>
    </VStack>
  );
}


export function RelayRow({
  name,
  relay,
  active = false,
  onToggle,
  isToggling = false,
}: {
  name: string;
  relay: string;
  active?: boolean;
  onToggle?: () => void;
  isToggling?: boolean;
}) {
  const Wrapper = onToggle ? Pressable : View;

  return (
    <HStack className="items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5">
      <VStack className="gap-0.5">
        <Text className="text-[15px] font-bold text-foreground">{name}</Text>
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {relay}
        </Text>
      </VStack>
      <Wrapper
        onPress={onToggle}
        disabled={isToggling}
        className={[
          'rounded-lg px-4 py-2 min-w-13 items-center',
          active ? 'bg-emerald-500' : 'bg-muted',
          isToggling ? 'opacity-60' : '',
        ].join(' ')}
      >
        {isToggling ? (
          <Spinner size="small" />
        ) : (
          <Text className={['text-[10px] font-bold uppercase tracking-wider', active ? 'text-white' : 'text-muted-foreground'].join(' ')}>
            {active ? 'On' : 'Off'}
          </Text>
        )}
      </Wrapper>
    </HStack>
  );
}
