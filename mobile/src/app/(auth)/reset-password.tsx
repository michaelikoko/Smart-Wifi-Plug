import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle, ChevronLeft, Eye, EyeOff, KeyRound, Lock,
  Zap,
} from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
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
import { resetPassword } from '../../api/auth-api';
import { usePasswordResetStore } from '../../store/password-reset-store';
import { Link } from '@/components/ui/link';
import { AuthBackground } from '@/components/auth-background';

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain a special character (!@#$%)'),
    confirmPassword: z.string(),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: 'Passwords do not match.',
      path: ['confirmPassword'],
    }
  );

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordScreen() {
  const router = useRouter();

  const resetToken = usePasswordResetStore((s) => s.resetToken);

  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [alert, setAlert] = useState<{
    title: string;
    description: string;
    action: 'error' | 'success' | 'warning' | 'info';
  } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Guard: no reset token, i.e this screen was reached incorrectly
    if (!resetToken) {
      router.replace('/(auth)/forgot-password');
    }
  }, [resetToken]);


  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      console.log("Reset successful");
      router.replace({
        pathname: '/(auth)/login',
        params: { justReset: '1' }, // Flag to show a "password reset successful" message on the login screen
      });
    },
    onError: (error) => {
      console.log("reset failed")
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Reset session expired or token already used — start over.
        setAlert({
          title: 'Session Expired',
          description: 'Your reset session has expired. Please request a new code.',
          action: 'error',
        });
        // Small delay so the user can read the message before navigating.
        setTimeout(() => router.replace('/(auth)/forgot-password'), 1500);
        return;
      }

      let description = 'Something went wrong. Please try again.';
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        description = 'Passwords do not match.';
      } else if (axios.isAxiosError(error) && error.response?.status === 500) {
        description = 'Something went wrong on our end. Please try again later.';
      }

      setAlert({ title: 'Update Failed', description, action: 'error' });
    },
  });

  const onSubmit = (formData: ResetPasswordFormData) => {
    if (!resetToken) return;

    resetPasswordMutation.mutate({
      resetToken,
      new_password: formData.password,
      confirm_password: formData.confirmPassword,
    });
  };

  // Don't render the form if we're about to redirect (no token)
  if (!resetToken) return null;

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
                  <VStack className="items-center gap-1.5">
                    <Heading size="xl" className="text-center text-foreground">
                      New Password
                    </Heading>
                    <Text className="text-center text-sm text-muted-foreground">
                      Configure a new access key for your operator terminal. Ensure credentials meet corporate security standards.
                    </Text>
                  </VStack>
                </VStack>

                <Controller
                  control={control}
                  name="password"
                  render={({ field: { value, onChange } }) => (
                    <FormControl isInvalid={!!errors.password} isRequired>
                      <FormControlLabel>
                        <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                          New Password
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl">
                        <InputSlot className="pl-3">
                          <InputIcon as={Lock} />
                        </InputSlot>
                        <InputField
                          placeholder="Enter your new password"
                          secureTextEntry={!showPw}
                          value={value}
                          onChangeText={onChange}
                        />
                        <InputSlot className="pr-3" onPress={() => setShowPw((v) => !v)}>
                          <InputIcon as={showPw ? EyeOff : Eye} />
                        </InputSlot>
                      </Input>
                      <FormControlError>
                        <FormControlErrorIcon as={AlertCircle} />
                        <FormControlErrorText>{errors.password?.message}</FormControlErrorText>
                      </FormControlError>
                    </FormControl>
                  )}
                />

                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { value, onChange } }) => (
                    <FormControl isInvalid={!!errors.confirmPassword} isRequired>
                      <FormControlLabel>
                        <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                          Confirm New Password
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl">
                        <InputSlot className="pl-3">
                          <InputIcon as={Lock} />
                        </InputSlot>
                        <InputField
                          placeholder="Confirm your new password"
                          secureTextEntry={!showConfirm}
                          value={value}
                          onChangeText={onChange}
                        />
                        <InputSlot className="pr-3" onPress={() => setShowConfirm((v) => !v)}>
                          <InputIcon as={showConfirm ? EyeOff : Eye} />
                        </InputSlot>
                      </Input>
                      <FormControlError>
                        <FormControlErrorIcon as={AlertCircle} />
                        <FormControlErrorText>{errors.confirmPassword?.message}</FormControlErrorText>
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
                  isDisabled={!isValid || resetPasswordMutation.isPending}
                  onPress={handleSubmit(onSubmit)}
                >
                  <ButtonText className="uppercase tracking-widest">
                    {resetPasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                  </ButtonText>
                  {resetPasswordMutation.isPending
                    ? <ButtonSpinner />
                    : <ButtonIcon as={KeyRound} />}
                </Button>

              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </View>
    </AuthBackground>
  );
}