import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight, ChevronLeft, Eye, EyeOff, Lock, Mail, UserRound, AlertCircle,
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
import { Input, InputField, InputSlot, InputIcon } from '@/components/ui/input';
import { Link, LinkText } from '@/components/ui/link';
import { Zap } from 'lucide-react-native';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerUser } from '../../api/auth-api';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { AppAlert } from '@/components/app-alert';
import { AuthBackground } from '@/components/auth-background';

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(250, 'Full name must be less than 250 characters')
    ,

    email: z
      .email('Enter a valid email address')
      .toLowerCase(),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[0-9]/, 'Password must contain a number')
      .regex(
        /[^A-Za-z0-9]/,
        'Password must contain a special character'
      ),

    confirmPassword: z.string(),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }
  );

export type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [alert, setAlert] = useState<{
    title: string;
    description: string;
    action: 'error' | 'success' | 'warning' | 'info';
  } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (data) => {
      console.log('Registration successful:', data);
      setAlert({
        title: "Account Created",
        description: `Your account with email ${data.email} has been created successfully. Please proceed to Login`,
        action: 'success',
      });
      reset();
    },
    onError: (error) => {
      const message = {
        title: "Registration Failed",
        description: "An unexpected error occurred. Please try again later.",
      };

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 400) {
          message.title = "Invalid Input";
          message.description = "Please check your input and try again.";
        } else if (status === 409) {
          message.title = "Email Already Registered";
          message.description = "An account with this email already exists.";
        } else if (status === 401) {
          message.title = "Unauthorized";
          message.description = "Authentication failed.";
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

  const onSubmit = async (formData: RegisterFormData) => {
    console.log(formData);
    registerMutation.mutate(formData)
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
              <VStack className="gap-5">

                <VStack className="items-center gap-4">
                  <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                    <Link onPress={() => router.push('/(auth)/welcome')}>
                      <Zap size={26} className='text-primary' strokeWidth={2.5} />
                    </Link>
                  </View>
                  <VStack className="items-center gap-1.5">
                    <Heading size="xl" className="text-center text-foreground">
                      Register
                    </Heading>
                    <Text className="text-center text-sm text-muted-foreground">
                      Create a new account
                    </Text>
                  </VStack>
                </VStack>

                <Controller
                  control={control}
                  name="name"
                  render={({ field: { value, onChange } }) => (
                    <FormControl isInvalid={!!errors.name} isRequired>
                      <FormControlLabel>
                        <FormControlLabelText>
                          Full Name
                        </FormControlLabelText>
                      </FormControlLabel>

                      <Input>
                        <InputSlot>
                          <InputIcon as={UserRound} />
                        </InputSlot>

                        <InputField
                          placeholder="Jane Doe"
                          value={value}
                          onChangeText={onChange}
                        />
                      </Input>

                      <FormControlError>
                        <FormControlErrorIcon as={AlertCircle} />
                        <FormControlErrorText>
                          {errors.name?.message}
                        </FormControlErrorText>
                      </FormControlError>
                    </FormControl>
                  )}
                />

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

                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { value, onChange } }) => (
                    <FormControl isInvalid={!!errors.confirmPassword} isRequired>
                      <FormControlLabel>
                        <FormControlLabelText>
                          Confirm Password
                        </FormControlLabelText>
                      </FormControlLabel>

                      <Input>
                        <InputSlot>
                          <InputIcon as={Lock} />
                        </InputSlot>

                        <InputField
                          value={value}
                          onChangeText={onChange}
                          secureTextEntry={!showConfirmPassword}
                          placeholder="Confirm Password"
                        />

                        <InputSlot
                          onPress={() => setShowConfirmPassword((prevValue) => !prevValue)}
                        >
                          <InputIcon as={showConfirmPassword ? EyeOff : Eye} />
                        </InputSlot>
                      </Input>

                      <FormControlError>
                        <FormControlErrorIcon as={AlertCircle} />
                        <FormControlErrorText>
                          {errors.confirmPassword?.message}
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
                <Button
                  size="lg"
                  className="w-full rounded-xl bg-primary py-4"
                  isDisabled={!isValid || registerMutation.isPending}
                  onPress={handleSubmit(onSubmit)}
                >

                  <ButtonText className="uppercase tracking-widest">
                    {
                      registerMutation.isPending ? 'Creating Account...' : 'Create Account'
                    }
                  </ButtonText>
                  {
                    registerMutation.isPending ? <ButtonSpinner className='text-primary' /> : <ButtonIcon as={ArrowRight} />
                  }
                </Button>

                <HStack className="items-center justify-center gap-1">
                  <Text className="text-sm text-muted-foreground">Already have an account?</Text>
                  <Link onPress={() => router.push('/(auth)/login')}>
                    <LinkText className="text-sm font-semibold">Login</LinkText>
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