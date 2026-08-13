import { useRouter } from 'expo-router';
import { ArrowRight, Plus, PlugZap, RefreshCw } from 'lucide-react-native';

import { View } from 'react-native';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText, ButtonIcon } from '@/components/ui/button';

export default function DevicesScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-secondary px-5 py-6 dark:bg-background">
      <VStack className="mx-auto flex-1 w-full max-w-sm justify-center gap-5">
        <Card size="default" className="w-full rounded-2xl">
          <VStack className="items-center gap-4 py-2">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border">
              <PlugZap size={28} color="#737373" />
            </View>

            <VStack className="items-center gap-2">
              <Heading size="xl" className="text-center text-foreground">
                Devices
              </Heading>
              <Text className="max-w-xs text-center text-sm text-muted-foreground">
                Manage and monitor connected relays and smart plugs from here.
              </Text>
            </VStack>

            <VStack className="mt-2 w-full gap-3">
              <Button
                size="lg"
                className="w-full rounded-xl bg-primary py-4"
                onPress={() => router.push('/(app)/add-device')}
              >
                <ButtonIcon as={Plus} />
                <ButtonText className="uppercase tracking-widest">
                  Add Device
                </ButtonText>
                <ButtonIcon as={ArrowRight} />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-xl py-4"
                onPress={() => router.push('/(app)/add-device/provision-device')}
              >
                <ButtonIcon as={RefreshCw} />
                <ButtonText className="uppercase tracking-widest">
                  Provision Device
                </ButtonText>
                <ButtonIcon as={ArrowRight} />
              </Button>

              <VStack className="w-full items-start gap-1 px-1">
                <Text className="text-xs text-muted-foreground">
                  <Text className="font-semibold text-foreground">New plug?</Text> Use Add Device.
                </Text>
                <Text className="text-xs text-muted-foreground">
                  <Text className="font-semibold text-foreground">Re-adding after reset?</Text> Use Provision Device.
                </Text>
              </VStack>
            </VStack>
          </VStack>
        </Card>
      </VStack>
    </View>
  );
}
