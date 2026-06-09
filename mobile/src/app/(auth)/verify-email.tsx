import { Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import {
  AppHeading,
  OtpBoxes,
  PrimaryAction,
  ScreenFrame,
  SectionCard,
  SmallLink,
  TopBack,
} from '@/components/app-ui';

export default function VerifyEmailScreen() {
  return (
    <ScreenFrame>
      <View className="mx-auto w-full max-w-md gap-4">
        <TopBack label="Verification" href="/login" />

        <SectionCard className="gap-6">
          <View className="items-center gap-4">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <ShieldCheck size={28} className="text-primary" />
            </View>
            <AppHeading
              title="Verify Email"
              subtitle="Enter the 6-digit code sent to your email."
            />
          </View>

          <OtpBoxes />

          <View className="items-center gap-1">
            <Text className="text-sm text-muted-foreground">
              Didn&apos;t receive code?{' '}
              <SmallLink href="/verify-email">Resend code</SmallLink>
            </Text>
          </View>

          <PrimaryAction href="/reset-password">Verify</PrimaryAction>
        </SectionCard>
      </View>
    </ScreenFrame>
  );
}
