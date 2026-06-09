import { Text, View } from 'react-native';
import { Bell, CheckCircle2, CircleX, PlugZap } from 'lucide-react-native';
import {
  AppLogo,
  BottomNav,
  MetricCard,
  RelayRow,
  ScreenFrame,
  SectionCard,
  StatusPill,
  WeeklyBars,
} from '@/components/app-ui';

export default function HomeScreen() {
  return (
    <ScreenFrame scroll>
      <View className="mx-auto w-full max-w-md gap-4">
        <View className="flex-row items-center justify-between rounded-3xl border border-border bg-card px-4 py-3">
          <View className="flex-row items-center gap-3">
            <AppLogo size="sm" />
            <View>
              <Text className="text-lg font-extrabold text-foreground">
                GridCore Pulse
              </Text>
              <Text className="text-xs text-muted-foreground">
                Industrial energy control
              </Text>
            </View>
          </View>
          <View className="relative h-10 w-10 items-center justify-center rounded-2xl bg-muted">
            <Bell size={20} className="text-foreground" />
            <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive" />
          </View>
        </View>

        <View className="gap-1 px-1">
          <Text className="text-2xl font-black text-foreground">
            Hello, Alex
          </Text>
          <Text className="text-base text-muted-foreground">
            System is operating normally.
          </Text>
        </View>

        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              System Overview
            </Text>
            <StatusPill tone="green">Optimal</StatusPill>
          </View>

          <View className="flex-row gap-3">
            <MetricCard label="Current Load" value="4.2" unit="kW" />
            <MetricCard label="Energy Today" value="12.8" unit="kWh" />
          </View>
        </SectionCard>

        <SectionCard className="gap-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Device Status
          </Text>
          <View className="gap-3">
            <View className="flex-row items-center justify-between rounded-2xl border border-border bg-background px-4 py-4">
              <View className="flex-row items-center gap-3">
                <CheckCircle2 size={18} className="text-primary" />
                <Text className="text-sm text-foreground">
                  Online Devices
                </Text>
              </View>
              <Text className="text-base font-bold text-foreground">3</Text>
            </View>
            <View className="flex-row items-center justify-between rounded-2xl border border-border bg-background px-4 py-4">
              <View className="flex-row items-center gap-3">
                <CircleX size={18} className="text-muted-foreground" />
                <Text className="text-sm text-foreground">
                  Offline Devices
                </Text>
              </View>
              <Text className="text-base font-bold text-foreground">0</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard>
          <WeeklyBars />
        </SectionCard>

        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Relay Control
            </Text>
            <View className="flex-row items-center gap-2">
              <PlugZap size={16} className="text-primary" />
              <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                2 Active
              </Text>
            </View>
          </View>

          <View className="gap-3">
            <RelayRow name="Main Server Room" relay="Relay 1" active />
            <RelayRow name="Floor 2 Lighting" relay="Relay 2" />
          </View>
        </SectionCard>

        <BottomNav />
      </View>
    </ScreenFrame>
  );
}
