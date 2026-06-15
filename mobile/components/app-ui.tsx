/**
 * GridCore Pulse — minimal shared utilities
 *
 * This file is intentionally thin. Gluestack v5 alpha components handle
 * all primitives (Button, Input, FormControl, Card, VStack, HStack, etc.).
 * Only things Gluestack doesn't provide live here:
 *   - WeeklyBars     (custom bar chart — no chart component in GS)
 *   - RelayRow       (domain-specific composite)
 *   - MetricCard     (domain-specific composite)
 *   - BottomNav      (domain-specific composite)
 *   - OtpInput       (multi-cell numeric input — no OTP component in GS)
 */

import React, { useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Divider } from '@/components/ui/divider';
import { Bell, Home, PlugZap, BarChart3, Smartphone } from 'lucide-react-native';

// ─── OTP multi-cell input ────────────────────────────────────────────────────

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
          // We use a clean View wrapper styled with your Tailwind/NativeWind theme
          <View
            key={i}
            className={`h-14 w-11 items-center justify-center rounded-xl border bg-card ${
              isFocused ? 'border-2 border-primary' : 'border-border'
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
              // Standard styling that passes text properties natively without breaking NativeWind v5
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

// ─── Weekly bar chart (no GS equivalent) ────────────────────────────────────

const BAR_DATA = [
  { day: 'Mon', h: 36 }, { day: 'Tue', h: 64 }, { day: 'Wed', h: 88 },
  { day: 'Thu', h: 52 }, { day: 'Fri', h: 74 }, { day: 'Sat', h: 30 }, { day: 'Sun', h: 44 },
];

export function WeeklyBars() {
  return (
    <VStack className="gap-3">
      <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Weekly Consumption (kWh)
      </Text>
      <HStack className="h-44 items-end justify-between rounded-xl border border-border bg-secondary px-3 pb-3 pt-4">
        {BAR_DATA.map((item, idx) => (
          <VStack key={item.day} className="flex-1 items-center gap-1.5">
            <View
              className={idx % 2 === 0
                ? 'w-full max-w-[20px] rounded-t-lg bg-primary'
                : 'w-full max-w-[20px] rounded-t-lg bg-primary/50'}
              style={{ height: item.h }}
            />
            <Text className="text-[9px] text-muted-foreground">{item.day}</Text>
          </VStack>
        ))}
      </HStack>
    </VStack>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

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

// ─── Relay row ───────────────────────────────────────────────────────────────

export function RelayRow({ name, relay, active = false }: { name: string; relay: string; active?: boolean }) {
  return (
    <HStack className="items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5">
      <VStack className="gap-0.5">
        <Text className="text-[15px] font-bold text-foreground">{name}</Text>
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {relay}
        </Text>
      </VStack>
      <View className={['rounded-lg px-4 py-2', active ? 'bg-emerald-500' : 'bg-muted'].join(' ')}>
        <Text className={['text-[10px] font-bold uppercase tracking-wider', active ? 'text-white' : 'text-muted-foreground'].join(' ')}>
          {active ? 'On' : 'Off'}
        </Text>
      </View>
    </HStack>
  );
}

// ─── Bottom navigation bar ───────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Home', Icon: Home, badge: false },
  { label: 'Devices', Icon: PlugZap, badge: false },
  { label: 'Analytics', Icon: BarChart3, badge: false },
  { label: 'Alerts', Icon: Bell, badge: true },
  { label: 'Profile', Icon: Smartphone, badge: false },
] as const;

export function BottomNav({ active = 'Home' }: { active?: string }) {
  return (
    <>
      <Divider />
      <HStack className="items-center justify-around bg-card px-2 pb-7 pt-2">
        {NAV_ITEMS.map(({ label, Icon, badge }) => {
          const isActive = label === active;
          return (
            <Pressable key={label} className="flex-1 items-center gap-0.5 rounded-xl py-2">
              <View
                className={['items-center justify-center rounded-xl px-3 py-1.5 relative', isActive ? 'bg-secondary' : ''].join(' ')}
              >
                <Icon size={20} color={isActive ? '#171717' : '#737373'} />
                {badge ? (
                  <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                ) : null}
              </View>
              <Text className={['text-[10px]', isActive ? 'font-bold text-foreground' : 'text-muted-foreground'].join(' ')}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>
    </>
  );
}