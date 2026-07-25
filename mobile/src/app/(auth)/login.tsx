import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  AlertCircle,
  ArrowRight, Eye, EyeOff, Lock, Mail,
} from 'lucide-react-native';

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
import {
  Input,
  InputField,
  InputSlot,
  InputIcon,
} from '@/components/ui/input';
import { Link, LinkText } from '@/components/ui/link';
import { Zap } from 'lucide-react-native';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppAlert } from '@/components/app-alert';
import { useMutation } from '@tanstack/react-query';
import { loginUser } from '../../api/auth-api';
import axios from 'axios';
import { usePasswordResetStore } from '../../store/password-reset-store';
import { AuthBackground } from '@/components/auth-background';

export const loginSchema = z
  .object({
    email: z
      .email('Enter a valid email address')
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(1, 'Password is required'),
//      .min(8, 'Password must be at least 8 characters')
//      .regex(/[0-9]/, 'Password must contain a number')
//      .regex(
//        /[^A-Za-z0-9]/,
//        'Password must contain a special character'
//      ),
  });

export type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ justReset?: string }>();
  const clearResetSession = usePasswordResetStore((s) => s.clear);

  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState<{
    title: string;
    description: string;
    action: 'error' | 'success' | 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    // Show a success message after a completed password reset
    if (params.justReset === '1') {
      clearResetSession();

      setAlert({
        title: 'Password Updated',
        description: 'Your password has been changed. Please log in again.',
        action: 'success',
      });
    }
  }, [params.justReset]);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      console.log('Login successful:', data);
      reset();
      router.replace('/(app)/home');
    },
    onError: (error) => {
      //console.error('Login failed:', error);
      const message = {
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again later.",
      };

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 422) {
          message.title = "Invalid Input";
          message.description = "Please check your input and try again.";
        }
        else if (status === 401) {
          message.title = "Unauthorized";
          message.description = "Invalid email or password.";
        } else if (status === 500) {
          message.title = "Server Error";
          message.description = "Something went wrong on our end. Please try again later.";
        }
      }

      setAlert({
        title: message.title,
        description: message.description,
        action: 'error',
      });
    }
  })

  const onSubmit = async (formData: LoginFormData) => {
    console.log('Form Data:', formData);
    loginMutation.mutate(formData);
  }

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
                      Login
                    </Heading>
                    <Text className="text-center text-sm text-muted-foreground">
                      Welcome back. Please authenticate to continue.
                    </Text>
                  </VStack>
                </VStack>

                <Controller
                  control={control}
                  name="email"
                  render={({ field: { value, onChange } }) => (
                    <FormControl isInvalid={!!errors.email} isRequired>
                      <FormControlLabel>
                        <FormControlLabelText>
                          Email Address
                        </FormControlLabelText>
                      </FormControlLabel>

                      <Input>
                        <InputSlot>
                          <InputIcon as={Mail} />
                        </InputSlot>

                        <InputField
                          value={value}
                          onChangeText={onChange}
                          placeholder="janedoe@email.com"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </Input>

                      <FormControlError>
                        <FormControlErrorIcon as={AlertCircle} />
                        <FormControlErrorText>
                          {errors.email?.message}
                        </FormControlErrorText>
                      </FormControlError>
                    </FormControl>
                  )}
                />


                <Controller
                  control={control}
                  name="password"
                  render={({ field: { value, onChange } }) => (
                    <FormControl isInvalid={!!errors.password} isRequired>
                      <FormControlLabel>
                        <FormControlLabelText>
                          Password
                        </FormControlLabelText>
                      </FormControlLabel>

                      <Input>
                        <InputSlot>
                          <InputIcon as={Lock} />
                        </InputSlot>

                        <InputField
                          value={value}
                          onChangeText={onChange}
                          secureTextEntry={!showPassword}
                          placeholder="Enter Password"
                        />

                        <InputSlot
                          onPress={() => setShowPassword((prevValue) => !prevValue)}
                        >
                          <InputIcon as={showPassword ? EyeOff : Eye} />
                        </InputSlot>
                      </Input>

                      <FormControlError>
                        <FormControlErrorIcon as={AlertCircle} />
                        <FormControlErrorText>
                          {errors.password?.message}
                        </FormControlErrorText>
                      </FormControlError>
                    </FormControl>
                  )}
                />

                {
                  alert && (
                    <AppAlert
                      title={alert.title}
                      description={alert.description}
                      action={alert.action}
                      onClose={() => setAlert(null)}
                    />
                  )
                }
                <HStack className="items-center justify-end gap-0.5">
                  <Link onPress={() => router.push('/(auth)/forgot-password')}>
                    <LinkText className="text-sm font-semibold">Forgot Password?</LinkText>
                  </Link>
                </HStack>
                <Button
                  size="lg"
                  className="w-full rounded-xl bg-primary py-4"
                  isDisabled={!isValid || loginMutation.isPending}
                  onPress={handleSubmit(onSubmit)}
                >

                  <ButtonText className="uppercase tracking-widest">
                    {
                      loginMutation.isPending ? 'Logging In...' : 'Login'
                    }
                  </ButtonText>
                  {
                    loginMutation.isPending ? <ButtonSpinner className='text-primary' /> : <ButtonIcon as={ArrowRight} />
                  }
                </Button>

                <HStack className="items-center justify-center gap-1">
                  <Text className="text-sm text-muted-foreground">Don't have an account?</Text>
                  <Link onPress={() => router.push('/(auth)/register')}>
                    <LinkText className="text-sm font-semibold">Register</LinkText>
                  </Link>
                </HStack>

              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </View>
    </AuthBackground>
  );
}