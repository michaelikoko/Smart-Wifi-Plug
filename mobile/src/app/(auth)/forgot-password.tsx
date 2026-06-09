import { Text, View } from 'react-native';
import { Mail, ArrowLeft } from 'lucide-react-native';
import {
  AppHeading,
  Field,
  GhostAction,
  PrimaryAction,
  ScreenFrame,
  SectionCard,
  TopBack,
} from '@/components/app-ui';

export default function ForgotPasswordScreen() {
  return (
    <ScreenFrame>
      <View className="mx-auto w-full max-w-md gap-4">
        <TopBack label="Back to Login" href="/login" />

        <SectionCard className="gap-6">
          <View className="items-center gap-4">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-accent">
              <Mail size={28} className="text-primary" />
            </View>
            <AppHeading
              title="Reset Password"
              subtitle="Enter your registered email to receive a verification code."
            />
          </View>

          <Field
            label="Email Address"
            placeholder="engineer@gridcore.io"
            keyboardType="email-address"
            prefixIcon={<Mail size={18} className="text-muted-foreground" />}
          />

          <PrimaryAction href="/verify-email">Send OTP</PrimaryAction>
          <GhostAction href="/login" leftIcon={<ArrowLeft size={16} className="text-muted-foreground" />}>
            Back to Login
          </GhostAction>

          <View className="border-t border-border pt-4">
            <Text className="text-center text-xs uppercase tracking-[0.28em] text-muted-foreground">
              GridCore Identity Service v2.4
            </Text>
          </View>
        </SectionCard>
      </View>
    </ScreenFrame>
  );
}
