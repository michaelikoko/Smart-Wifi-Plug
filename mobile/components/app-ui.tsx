import { useRef } from 'react';
import { Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Spinner } from './ui/spinner';
import { BarChart } from 'react-native-gifted-charts';


export function OtpInput({
  length = 6,
  value,
  onChange,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputs = useRef<Array<TextInput | null>>([]);

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
  kwh: number;   // raw kWh value for this day
  costKobo: number | null; // The cost in kobo from the backend
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
export function WeeklyBars({ data }: { data: WeeklyBarDatum[] }) {
  const { width } = useWindowDimensions();
  const FALLBACK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hasData = data.length > 0;

  // 1. Prepare data for the chart
  const barData = FALLBACK_DAYS.map((dayLabel, idx) => {
    const existingDay = data.find((d) => d.day === dayLabel);
    const kwhValue = existingDay ? existingDay.kwh : 0;
    const costValue = existingDay?.costKobo != null ? existingDay.costKobo / 100 : 0;

    return {
      label: dayLabel,
      value: kwhValue,
      costFormatted: costValue > 0 ? `₦${costValue.toFixed(2)}` : '₦0.00',
      // Maintain your alternating colors (you'll need to use your actual hex codes here)
      frontColor: WEEKLY_COLORS[idx % WEEKLY_COLORS.length], 
    };
  });

  const maxKwh = hasData ? Math.max(...barData.map((d) => d.value), 0.001) : 1;

  return (
    <VStack className="gap-3">
      <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Weekly Consumption
      </Text>
      
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
            xAxisLabelTextStyle={{ color: '#737373', fontSize: 10, textAlign: 'center' }}
            maxValue={maxKwh} // Give a 20% visual buffer at the top
            noOfSections={4}
            //showLine = {true}
            yAxisExtraHeight={50}
            // --- The Interactive Tooltip Magic ---
            renderTooltip={(item: any) => {
              return (
                <View className="mb-2 items-center justify-center rounded-md bg-foreground px-2 py-1 shadow-lg">
                  <Text className="text-[10px] font-bold text-background">
                    {item.value.toFixed(2)} kWh
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
          'rounded-lg px-4 py-2 min-w-[52px] items-center',
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
