import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, ShieldCheck, Smartphone, Zap } from 'lucide-react-native';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText, ButtonIcon } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { AuthBackground } from '@/components/auth-background';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <AuthBackground>
      <View className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow items-center justify-center px-5 py-10"
        >
          <VStack className="w-full max-w-sm gap-8">

            <VStack className="items-center gap-4">
              <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary">
                <Zap size={38} className='text-primary' strokeWidth={2.5} />
              </View>
              <VStack className="items-center gap-2">
                <Heading size="2xl" className="text-center text-foreground">
                  SmartPlug
                </Heading>
                <Text className="max-w-xs text-center text-sm text-muted-foreground">
                  Advanced energy monitoring and industrial relay control at your fingertips.
                </Text>
              </VStack>
            </VStack>

            <VStack className="gap-3">
              <Button
                size="lg"
                className="w-full rounded-xl bg-primary py-4"
                onPress={() => router.push('/(auth)/register')}
              >
                <ButtonText className="uppercase tracking-widest">Create Account</ButtonText>
                <ButtonIcon as={ArrowRight} />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-xl py-4"
                onPress={() => router.push('/(auth)/login')}
              >
                <ButtonText className="uppercase tracking-widest">Login</ButtonText>
              </Button>
            </VStack>

            <Card size="sm" className="w-full rounded-2xl">
              <HStack className="items-center gap-3 py-1">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <Smartphone size={20} className="text-primary" />
                </View>
                <VStack className="flex-1 gap-0.5">
                  <Text className="text-[13px] font-bold text-foreground">
                    Real-time device control
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Switch plugs and monitor status instantly
                  </Text>
                </VStack>
              </HStack>

              <Divider className="my-3" />

              <HStack className="items-center gap-3 py-1">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                  <ShieldCheck size={20} className="text-primary" />
                </View>
                <VStack className="flex-1 gap-0.5">
                  <Text className="text-[13px] font-bold text-foreground">
                    Energy Insights
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    Track voltage, power, and energy usage over time
                  </Text>
                </VStack>
              </HStack>
            </Card>
          </VStack>
        </ScrollView>
      </View>
    </AuthBackground>
  );
}