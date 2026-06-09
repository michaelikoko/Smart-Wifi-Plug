import { Text, View } from 'react-native';
import { ArrowRight, ShieldCheck, Smartphone } from 'lucide-react-native';
import {
  AppHeading,
  GhostAction,
  PrimaryAction,
  ScreenFrame,
  SectionCard,
  StatusPill,
} from '@/components/app-ui';

export default function WelcomeScreen() {
  return (
    <ScreenFrame center>
      <View className="w-full max-w-md items-center gap-6">
        <AppHeading
          title="Smart Wifi Plug"
          subtitle="Advanced remote energy monitoring and control at your fingertips."
        />

        <View className="w-full gap-3">
          <PrimaryAction href="/register">Create Account</PrimaryAction>
          <GhostAction href="/login">Login</GhostAction>
        </View>

        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accent">
                <ShieldCheck size={20} className="text-primary" />
              </View>
              <View>
                <Text className="text-sm font-bold text-foreground">
                  Secure operator access
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Provisioned for industrial workflows
                </Text>
              </View>
            </View>
            <StatusPill tone="blue">Nominal</StatusPill>
          </View>

          <View className="h-px bg-border" />

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                <Smartphone size={20} className="text-foreground" />
              </View>
              <View>
                <Text className="text-sm font-bold text-foreground">
                  Mobile-first dashboard
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Built for quick status checks
                </Text>
              </View>
            </View>
            <ArrowRight size={18} className="text-muted-foreground" />
          </View>
        </SectionCard>
      </View>
    </ScreenFrame>
  );
}
