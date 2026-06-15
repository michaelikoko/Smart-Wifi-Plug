import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, ArrowRight, ChevronLeft, Mail, Zap } from 'lucide-react-native';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from '@/components/ui/button';
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlError,
  FormControlErrorIcon,
  FormControlErrorText,
} from '@/components/ui/form-control';
import { Input, InputField, InputSlot, InputIcon } from '@/components/ui/input';

import { AppAlert } from '@/components/app-alert';
import { forgotPassword } from '../../api/auth-api';
import { usePasswordResetStore } from '../../store/password-reset-store';
import { Link } from '@/components/ui/link';
import { AuthBackground } from '@/components/auth-background';


const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address').toLowerCase(),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const setEmail = usePasswordResetStore((s) => s.setEmail);

  const [alert, setAlert] = useState<{
    title: string;
    description: string;
    action: 'error' | 'success' | 'warning' | 'info';
  } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: { email: '' },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (_data, variables) => {
      // Stash the email for the OTP + Reset screens
      setEmail(variables.email);

      router.push({
        pathname: '/(auth)/otp-verify-reset',
        params: { email: variables.email },
      });
    },
    onError: (error) => {
      // The backend always returns 200 for forgot-password, so a thrown
      // error here means a genuine network/server problem — not "email
      // not found" (which is intentionally indistinguishable).
      const message = {
        title: 'Something Went Wrong',
        description: 'Please check your connection and try again.',
      };

      if (axios.isAxiosError(error) && error.response?.status === 500) {
        message.title = 'Server Error';
        message.description = 'Something went wrong on our end. Please try again later.';
      }

      setAlert({ title: message.title, description: message.description, action: 'error' });
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    forgotPasswordMutation.mutate(data);
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
                <VStack className="items-center gap-4">
                  <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                    <Link onPress={() => router.push('/(auth)/welcome')}>
                      <Zap size={26} className='text-primary' strokeWidth={2.5} />
                    </Link>
                  </View>
                </VStack>


                <VStack className="items-center gap-2">
                  <Heading size="xl" className="text-center text-foreground">
                    Reset Password
                  </Heading>
                  <Text className="text-center text-sm text-muted-foreground">
                    Enter your registered email to receive a verification code.
                  </Text>
                </VStack>

                <Controller
                  control={control}
                  name="email"
                  render={({ field: { value, onChange } }) => (
                    <FormControl isInvalid={!!errors.email} isRequired>
                      <FormControlLabel>
                        <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                          Email Address
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl">
                        <InputSlot className="pl-3">
                          <InputIcon as={Mail} />
                        </InputSlot>
                        <InputField
                          placeholder="janejuliet@email.com"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={value}
                          onChangeText={onChange}
                        />
                      </Input>
                      <FormControlError>
                        <FormControlErrorIcon as={AlertCircle} />
                        <FormControlErrorText>{errors.email?.message}</FormControlErrorText>
                      </FormControlError>
                    </FormControl>
                  )}
                />

                {alert && (
                  <AppAlert
                    title={alert.title}
                    description={alert.description}
                    action={alert.action}
                    onClose={() => setAlert(null)}
                  />
                )}

                <Button
                  size="lg"
                  className="w-full rounded-xl bg-primary py-4"
                  isDisabled={!isValid || forgotPasswordMutation.isPending}
                  onPress={handleSubmit(onSubmit)}
                >
                  <ButtonText className="uppercase tracking-widest">
                    {forgotPasswordMutation.isPending ? 'Sending...' : 'Send OTP'}
                  </ButtonText>
                  {forgotPasswordMutation.isPending
                    ? <ButtonSpinner />
                    : <ButtonIcon as={ArrowRight} />}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-xl py-4"
                  onPress={() => router.push('/(auth)/login')}
                >
                  <ButtonIcon as={ChevronLeft} />
                  <ButtonText>Back to Login</ButtonText>
                </Button>
              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </View>
    </AuthBackground>
  );
}