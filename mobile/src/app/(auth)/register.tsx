import { Text, View } from 'react-native';
import { Eye, Mail, UserRound, Lock } from 'lucide-react-native';
import {
  AppHeading,
  CheckListItem,
  Field,
  PrimaryAction,
  ScreenFrame,
  SectionCard,
  SecurityMeter,
  SmallLink,
  TopBack,
} from '@/components/app-ui';

export default function RegisterScreen() {
  return (
    <ScreenFrame>
      <View className="mx-auto w-full max-w-md gap-4">
        <TopBack label="Create Account" href="/welcome" />

        <SectionCard className="gap-5">
          <AppHeading
            title="Create Account"
            subtitle="GridCore Pulse access provisioning"
            compact
          />

          <View className="gap-4">
            <Field
              label="Full Name"
              placeholder="Jane Doe"
              prefixIcon={<UserRound size={18} className="text-muted-foreground" />}
            />
            <Field
              label="Email Address"
              placeholder="jane.doe@engineering.com"
              keyboardType="email-address"
              prefixIcon={<Mail size={18} className="text-muted-foreground" />}
            />
            <View className="gap-2">
              <Text className="text-[13px] font-semibold uppercase tracking-[0.24em] text-foreground">
                Password
              </Text>
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

            <SecurityMeter label="Security Clearance" state="Weak" ratio={0.28} />

            <View className="gap-2">
              <CheckListItem complete={false}>8+ characters</CheckListItem>
              <CheckListItem complete={false}>Number or symbol</CheckListItem>
            </View>

            <View className="gap-2">
              <Text className="text-[13px] font-semibold uppercase tracking-[0.24em] text-foreground">
                Confirm Password
              </Text>
              <View className="flex-row items-center gap-3 rounded-xl border border-input bg-background px-4 py-3">
                <Lock size={18} className="text-muted-foreground" />
                <View className="flex-1">
                  <Text className="text-base text-muted-foreground">
                    • • • • • • • •
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <PrimaryAction href="/verify-email">Register Access Key</PrimaryAction>

          <View className="items-center">
            <Text className="text-sm text-muted-foreground">
              Already have an account? <SmallLink href="/login">Login</SmallLink>
            </Text>
          </View>
        </SectionCard>
      </View>
    </ScreenFrame>
  );
}
