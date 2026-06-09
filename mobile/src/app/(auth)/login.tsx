import { Text, View } from 'react-native';
import { Eye, Mail, Lock } from 'lucide-react-native';
import {
  AppHeading,
  Field,
  GhostAction,
  PrimaryAction,
  ScreenFrame,
  SectionCard,
  SmallLink,
  TopBack,
} from '@/components/app-ui';

export default function LoginScreen() {
  return (
    <ScreenFrame>
      <View className="mx-auto w-full max-w-md gap-4">
        <TopBack label="System Access" href="/welcome" />

        <SectionCard className="gap-6">
          <AppHeading
            title="GridCore Pulse"
            subtitle="Welcome back. Please authenticate to continue."
          />

          <View className="gap-4">
            <Field
              label="Email Address"
              placeholder="name@company.com"
              keyboardType="email-address"
              prefixIcon={<Mail size={18} className="text-muted-foreground" />}
            />
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-[13px] font-semibold uppercase tracking-[0.24em] text-foreground">
                  Password
                </Text>
                <SmallLink href="/forgot-password">Forgot Password?</SmallLink>
              </View>
              <View className="flex-row items-center gap-3 rounded-xl border border-input bg-background px-4 py-3">
                <Lock size={18} className="text-muted-foreground" />
                <View className="flex-1">
                  <Text className="text-base text-muted-foreground">
                    • • • • • • • •
                  </Text>
                </View>
                <Eye size={18} className="text-muted-foreground" />
              </View>
            </View>

            <PrimaryAction href="/home">Login</PrimaryAction>
          </View>

          <GhostAction href="/register">Don&apos;t have an account? Register</GhostAction>
        </SectionCard>
      </View>
    </ScreenFrame>
  );
}
