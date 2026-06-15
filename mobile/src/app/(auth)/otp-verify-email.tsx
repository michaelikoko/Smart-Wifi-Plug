import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronLeft, LockKeyhole } from 'lucide-react-native';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText, ButtonIcon } from '@/components/ui/button';
import { Pressable } from '@/components/ui/pressable';
import { OtpInput } from '@/components/app-ui';

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

export default function OtpVerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');

  const handleVerify = () => {
    // Placeholder only — backend not wired yet
    console.log('VERIFY EMAIL OTP (mock):', { email, code });

    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1">
      <ScrollView contentContainerClassName="flex-grow px-5 py-10">
        <VStack className="mx-auto w-full max-w-sm gap-6">

          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={16} />
          </Pressable>

          <Card>
            <VStack className="gap-6">

              <View className="items-center">
                <LockKeyhole size={28} />
              </View>

              <Heading className="text-center">
                Verify Email
              </Heading>

              <Text className="text-center">
                Enter code sent to {email ? maskEmail(email) : 'your email'}
              </Text>

              <OtpInput length={6} value={code} onChange={setCode} />

              <Button
                isDisabled={code.length !== 6}
                onPress={handleVerify}
              >
                <ButtonText>Verify</ButtonText>
                <ButtonIcon as={ArrowRight} />
              </Button>

            </VStack>
          </Card>

        </VStack>
      </ScrollView>
    </View>
  );
}