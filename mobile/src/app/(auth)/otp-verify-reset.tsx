import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronLeft, LockKeyhole } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from '@/components/ui/button';
import { Link, LinkText } from '@/components/ui/link';
import { Pressable } from '@/components/ui/pressable';

import { OtpInput } from '@/components/app-ui';
import { AppAlert } from '@/components/app-alert';
import { forgotPassword, verifyResetOtp } from '../../api/auth-api';
import { usePasswordResetStore } from '../../store/password-reset-store';
import { Spinner } from '@/components/ui/spinner';
import { AuthBackground } from '@/components/auth-background';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

const RESEND_COOLDOWN_SECONDS = 60;


export default function OtpVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; purpose?: string }>();

  // Fall back to the store's email if params are missing (e.g. after a resend navigation that doesn't re-pass params).
  const storeEmail = usePasswordResetStore((s) => s.email);
  const setResetToken = usePasswordResetStore((s) => s.setResetToken);

  const email = params.email ?? storeEmail ?? '';

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [alert, setAlert] = useState<{
    title: string;
    description: string;
    action: 'error' | 'success' | 'warning' | 'info';
  } | null>(null);

  const isComplete = code.length === 6;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);


  const verifyMutation = useMutation({
    mutationFn: verifyResetOtp,
    onSuccess: (data) => {
      setResetToken(data.reset_token);
      // Replace — this OTP is now consumed, no reason to go back to it.
      router.replace('/(auth)/reset-password');
    },
    onError: (error) => {
      let description = 'The code you entered is incorrect or has expired.';

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        description = 'Invalid or expired code. Please try again or request a new code.';
      } else if (axios.isAxiosError(error) && error.response?.status === 500) {
        description = 'Something went wrong on our end. Please try again later.';
      }

      setAlert({ title: 'Verification Failed', description, action: 'error' });
      setCode(''); // clear so user can retry cleanly
    },
  });

  const resendMutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: () => {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCode('');
      setAlert({
        title: 'Code Sent',
        description: `A new code has been sent to ${maskEmail(email)}.`,
        action: 'success',
      });
    },
    onError: () => {
      setAlert({
        title: 'Something Went Wrong',
        description: 'Could not resend the code. Please try again.',
        action: 'error',
      });
    },
  });

  const handleVerify = () => {
    if (!email) {
      setAlert({
        title: 'Session Expired',
        description: 'Please request a new code.',
        action: 'error',
      });
      router.replace('/(auth)/forgot-password');
      return;
    }
    verifyMutation.mutate({ email, otp: code });
  };

  const handleResend = () => {
    if (cooldown > 0 || resendMutation.isPending || !email) return;
    resendMutation.mutate({ email });
  };

  return (
    <AuthBackground>
      <View className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow justify-center px-5"
        >
          <VStack className="mx-auto w-full max-w-sm gap-5">
            <Card size="default" className="w-full rounded-2xl">
              <VStack className="gap-6">

                <View className="items-center">
                  <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                    <LockKeyhole size={28} color="#171717" />
                  </View>
                </View>

                <VStack className="items-center gap-2">
                  <Heading size="lg" className="text-center text-foreground">
                    Verify Email
                  </Heading>
                  <Text className="text-center text-sm text-muted-foreground">
                    Enter the 6-digit code sent to{' '}
                    {email ? (
                      <Text className="font-semibold text-foreground">{maskEmail(email)}</Text>
                    ) : (
                      'your email'
                    )}
                    .
                  </Text>
                </VStack>

                <OtpInput length={6} value={code} onChange={setCode} />

                {alert && (
                  <AppAlert
                    title={alert.title}
                    description={alert.description}
                    action={alert.action}
                    onClose={() => setAlert(null)}
                  />
                )}

                <HStack className="items-center justify-center gap-1">
                  <Text className="text-sm text-muted-foreground">Didn't receive code?</Text>
                  {resendMutation.isPending ? (
                    <Spinner />
                  ) : (
                    <Link onPress={handleResend} isDisabled={cooldown > 0}>
                      <LinkText
                        className={[
                          'text-sm font-semibold',
                          cooldown > 0 ? 'text-muted-foreground' : 'text-muted-foreground',
                        ].join(' ')}
                      >
                        {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
                      </LinkText>
                    </Link>
                  )}
                </HStack>

                <Button
                  size="lg"
                  className="w-full rounded-xl bg-primary py-4"
                  isDisabled={!isComplete || verifyMutation.isPending}
                  onPress={handleVerify}
                >
                  <ButtonText className="uppercase tracking-widest">
                    {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
                  </ButtonText>
                  {verifyMutation.isPending
                    ? <ButtonSpinner />
                    : <ButtonIcon as={ArrowRight} />}
                </Button>

              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </View>
    </AuthBackground>
  );
}