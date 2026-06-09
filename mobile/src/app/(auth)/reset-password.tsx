import { Text, View } from 'react-native';
import { Eye, Lock } from 'lucide-react-native';
import {
  CheckListItem,
  PrimaryAction,
  ScreenFrame,
  SectionCard,
  TopBack,
} from '@/components/app-ui';

export default function ResetPasswordScreen() {
  return (
    <ScreenFrame>
      <View className="mx-auto w-full max-w-md gap-4">
        <TopBack label="System Recovery" href="/login" />

        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-4xl font-black tracking-tight text-foreground">
              New Password
            </Text>
            <Text className="text-base leading-7 text-muted-foreground">
              Configure a new access key for your operator terminal. Ensure credentials meet corporate security standards.
            </Text>
          </View>

          <SectionCard className="gap-5">
            <View className="gap-2">
              <Text className="text-[13px] font-semibold uppercase tracking-[0.24em] text-foreground">
                New Password
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

            <View className="gap-2">
              <Text className="text-[13px] font-semibold uppercase tracking-[0.24em] text-foreground">
                Confirm New Password
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

            <View className="gap-4 rounded-2xl border border-border bg-accent p-4">
              <Text className="text-[13px] font-semibold uppercase tracking-[0.24em] text-foreground">
                Security Requirements
              </Text>
              <View className="gap-3">
                <CheckListItem complete>8+ characters minimum</CheckListItem>
                <CheckListItem>Contains at least one number</CheckListItem>
                <CheckListItem>Contains a special character (!@#$%)</CheckListItem>
              </View>
            </View>

            <PrimaryAction href="/login">Update Password</PrimaryAction>
          </SectionCard>
        </View>
      </View>
    </ScreenFrame>
  );
}
