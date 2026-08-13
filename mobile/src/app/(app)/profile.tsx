import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, User, Pencil, Banknote, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';

import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from '@/components/ui/button';
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlError,
  FormControlErrorIcon,
  FormControlErrorText,
} from '@/components/ui/form-control';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { AppAlert } from '@/components/app-alert';

import { useAuthStore } from '../../store/auth-store';
import { logoutUser } from '../../api/auth-api';
import { updateBillingRate, updateProfile, changePassword } from '../../api/users-api';
import { useAlertState } from '@/components/app-ui';

const billingRateSchema = z.object({
  rate: z
    .string()
    .trim()
    .min(1, 'Billing rate is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (up to 2 decimal places)')
    .refine((val) => Number(val) > 0, 'Rate must be greater than 0'),
});

type BillingRateFormData = z.infer<typeof billingRateSchema>;

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [isEditing, setIsEditing] = useState(false);
  const { alert: billingAlert, setAlert: setBillingAlert, clearAlert: clearBillingAlert } = useAlertState();


  // Profile card state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const { alert: profileAlert, setAlert: setProfileAlert, clearAlert: clearProfileAlert } = useAlertState();

  // Password card state
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { alert: passwordAlert, setAlert: setPasswordAlert, clearAlert: clearPasswordAlert } = useAlertState();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<BillingRateFormData>({
    resolver: zodResolver(billingRateSchema),
    mode: 'onChange',
    defaultValues: {
      rate: user?.billing_rate ? (user.billing_rate / 100).toFixed(2) : '',
    },
  });

  // Profile form
  const profileSchema = z.object({
    full_name: z.string().trim().min(1, 'Full name is required'),
  });
  type ProfileFormData = z.infer<typeof profileSchema>;

  const {
    control: profileControl,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors, isValid: profileIsValid },
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { full_name: user?.full_name ?? '' },
  });

  // Change password form
  const changePasswordSchema = z
    .object({
      old_password: z.string().min(1, 'Current password is required'),
      new_password: z.string().min(8, 'Password must be at least 8 characters'),
      confirm_password: z.string().min(1, 'Please confirm your new password'),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: "Passwords don't match",
      path: ['confirm_password'],
    })
    .refine((data) => data.new_password !== data.old_password, {
      message: 'New password must be different from your current password',
      path: ['new_password'],
    });

  type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

  const {
    control: passwordControl,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors, isValid: passwordIsValid },
    reset: resetPassword,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
    defaultValues: { old_password: '', new_password: '', confirm_password: '' },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      router.replace('/(auth)/login');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (billing_rate: number) => updateBillingRate({ billing_rate }),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setIsEditing(false);
      setBillingAlert({
        title: 'Billing Rate Updated',
        description: `Your rate is now ₦${(updatedUser.billing_rate! / 100).toFixed(2)} per kWh.`,
        action: 'success',
      });
    },
    onError: (error) => {
      let description = "We couldn't update your billing rate. Please try again.";
      if (isAxiosError(error) && error.response?.status === 422) {
        description = 'Please enter a valid rate greater than 0.';
      }
      setBillingAlert({ title: 'Update Failed', description, action: 'error' });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { full_name: string }) => updateProfile(data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setIsEditingProfile(false);
      setProfileAlert({ title: 'Profile Updated', description: 'Your name has been updated.', action: 'success' });
    },
    onError: () => {
      setProfileAlert({ title: 'Update Failed', description: "We couldn't update your profile. Please try again.", action: 'error' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordFormData) => changePassword(data),
    onSuccess: () => {
      // Server revokes refresh tokens — clear local state, reset form, and redirect to login which shows success alert
      resetPassword();
      useAuthStore.getState().logout();
      router.replace({ pathname: '/(auth)/login', params: { justReset: '1' } });
    },
    onError: (error) => {
      let description = "We couldn't update your password. Please try again.";
      if (isAxiosError(error) && error.response?.status === 401) {
        description = 'Current password is incorrect.';
      } else if (isAxiosError(error) && error.response?.status === 422) {
        description = 'Please check your password requirements and try again.';
      }
      setPasswordAlert({ title: 'Update Failed', description, action: 'error' });
    },
  });

  const onSubmit = (data: BillingRateFormData) => {
    clearBillingAlert();
    updateMutation.mutate(Math.round(Number(data.rate) * 100));
  };

  const onSubmitPassword = (data: ChangePasswordFormData) => {
    clearPasswordAlert();
    changePasswordMutation.mutate({
      old_password: data.old_password,
      new_password: data.new_password,
      confirm_password: data.confirm_password,
    });
  };

  return (
    <View className="flex-1 bg-secondary dark:bg-background">
      <View className="border-b border-border bg-card px-5 pb-4 pt-14">
        <HStack className="items-start justify-between gap-4">
          <VStack className="flex-1 gap-1">
            <Heading size="lg" className="text-foreground">
              Profiles
            </Heading>
            <Text className="text-[13px] text-muted-foreground">
              Manage your account and preferences.
            </Text>
          </VStack>
        </HStack>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 py-5 gap-4 pb-8"
      >
        {/* Identity Block */}
        <VStack className="items-center gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border">
            <User size={28} color="#737373" />
          </View>

          <VStack className="items-center gap-2">
            <Heading size="xl" className="text-center text-foreground">
              {user?.full_name ?? 'Profile'}
            </Heading>
            {user?.email ? (
              <Text className="text-center text-sm text-muted-foreground">{user.email}</Text>
            ) : null}
          </VStack>
        </VStack>

        {/* Personal Information Card */}
        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-6">
            {!isEditingProfile ? (
              <>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Full Name
                </Text>
                <VStack className="gap-2">
                  <Text className="text-foreground">{user?.full_name ?? ''}</Text>
                </VStack>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-xl"
                  onPress={() => setIsEditingProfile(true)}
                >
                  <ButtonText>Edit</ButtonText>
                  <ButtonIcon as={Pencil} />
                </Button>
              </>
            ) : (
              <>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Full Name
                </Text>

                <Controller
                  control={profileControl}
                  name="full_name"
                  render={({ field: { value, onChange } }) => (
                    <FormControl isInvalid={!!profileErrors.full_name} isRequired>
                      <FormControlLabel>
                        <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                          Full Name
                        </FormControlLabelText>
                      </FormControlLabel>
                      <Input className="rounded-xl">
                        <InputSlot className="pl-3">
                          <InputIcon as={User} />
                        </InputSlot>
                        <InputField value={value} onChangeText={onChange} placeholder="Jane Doe" />
                      </Input>
                      <FormControlError>
                        <FormControlErrorIcon as={AlertCircle} />
                        <FormControlErrorText>{profileErrors.full_name?.message}</FormControlErrorText>
                      </FormControlError>
                    </FormControl>
                  )}
                />

                <HStack className="gap-3">
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onPress={() => {
                      setIsEditingProfile(false);
                      resetProfile();
                    }}
                    isDisabled={updateProfileMutation.isPending}
                  >
                    <ButtonText>Cancel</ButtonText>
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1 rounded-xl bg-primary"
                    isDisabled={!profileIsValid || updateProfileMutation.isPending}
                    onPress={handleSubmitProfile((data: ProfileFormData) => {
                      updateProfileMutation.mutate({ full_name: data.full_name.trim() });
                    })}
                  >
                    <ButtonText>{updateProfileMutation.isPending ? 'Saving...' : 'Save'}</ButtonText>
                    {updateProfileMutation.isPending && <ButtonSpinner className="text-primary" />}
                  </Button>
                </HStack>
              </>
            )}

            {profileAlert ? (
              <AppAlert
                title={profileAlert.title}
                description={profileAlert.description}
                action={profileAlert.action}
                onClose={clearProfileAlert}
              />
            ) : null}
          </VStack>
        </Card>

        {/* Billing Rate Card */}
        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-6">
            {!isEditing ? (
              // View Mode
              <>
                <VStack className="gap-3">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Billing Rate
                  </Text>

                  {user?.billing_rate == null ? (
                    // Empty state
                    <>
                      <VStack className="items-center gap-2">
                        <Heading size="lg" className="text-center text-foreground">
                          Set your electricity rate
                        </Heading>
                        <Text className="text-center text-sm text-muted-foreground">
                          Set your electricity rate to see accurate cost estimates for your devices.
                        </Text>
                      </VStack>
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full rounded-xl"
                        onPress={() => setIsEditing(true)}
                      >
                        <ButtonText>Set Billing Rate</ButtonText>
                      </Button>
                    </>
                  ) : (
                    // Billing rate set
                    <>
                      <VStack className="gap-1">
                        <Text className="text-3xl font-bold text-foreground">
                          ₦{(user.billing_rate / 100).toFixed(2)}
                        </Text>
                        <Text className="text-sm text-muted-foreground">per kWh</Text>
                      </VStack>
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full rounded-xl"
                        onPress={() => setIsEditing(true)}
                      >
                        <ButtonText>Edit</ButtonText>
                        <ButtonIcon as={Pencil} />
                      </Button>
                    </>
                  )}
                </VStack>
              </>
            ) : (
              // Edit Mode
              <>
                <VStack className="gap-4">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Billing Rate
                  </Text>

                  <Controller
                    control={control}
                    name="rate"
                    render={({ field: { value, onChange } }) => (
                      <FormControl isInvalid={!!errors.rate} isRequired>
                        <FormControlLabel>
                          <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                            Rate per kWh (₦)
                          </FormControlLabelText>
                        </FormControlLabel>
                        <Input className="rounded-xl">
                          <InputSlot className="pl-3">
                            <InputIcon as={Banknote} />
                          </InputSlot>
                          <InputField
                            value={value}
                            onChangeText={onChange}
                            placeholder="209.50"
                            keyboardType="decimal-pad"
                            autoCorrect={false}
                          />
                        </Input>
                        <FormControlError>
                          <FormControlErrorIcon as={AlertCircle} />
                          <FormControlErrorText>{errors.rate?.message}</FormControlErrorText>
                        </FormControlError>
                      </FormControl>
                    )}
                  />
                </VStack>

                <HStack className="gap-3">
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onPress={() => {
                      setIsEditing(false);
                      reset();
                    }}
                    isDisabled={updateMutation.isPending}
                  >
                    <ButtonText>Cancel</ButtonText>
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1 rounded-xl bg-primary"
                    isDisabled={!isValid || updateMutation.isPending}
                    onPress={handleSubmit(onSubmit)}
                  >
                    <ButtonText>{updateMutation.isPending ? 'Saving...' : 'Save'}</ButtonText>
                    {updateMutation.isPending && <ButtonSpinner className="text-primary" />}
                  </Button>
                </HStack>
              </>
            )}

            {billingAlert ? (
              <AppAlert
                title={billingAlert.title}
                description={billingAlert.description}
                action={billingAlert.action}
                onClose={clearBillingAlert}
              />
            ) : null}
          </VStack>
        </Card>

        {/* Change Password Card */}
        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-6">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Change Password
            </Text>

            <Controller
              control={passwordControl}
              name="old_password"
              render={({ field: { value, onChange } }) => (
                <FormControl isInvalid={!!passwordErrors.old_password} isRequired>
                  <FormControlLabel>
                    <FormControlLabelText>Current Password</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputSlot>
                      <InputIcon as={Lock} />
                    </InputSlot>
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      secureTextEntry={!showOldPassword}
                      placeholder="Current password"
                    />
                    <InputSlot onPress={() => setShowOldPassword((v) => !v)}>
                      <InputIcon as={showOldPassword ? EyeOff : Eye} />
                    </InputSlot>
                  </Input>
                  <FormControlError>
                    <FormControlErrorIcon as={AlertCircle} />
                    <FormControlErrorText>{passwordErrors.old_password?.message}</FormControlErrorText>
                  </FormControlError>
                </FormControl>
              )}
            />

            <Controller
              control={passwordControl}
              name="new_password"
              render={({ field: { value, onChange } }) => (
                <FormControl isInvalid={!!passwordErrors.new_password} isRequired>
                  <FormControlLabel>
                    <FormControlLabelText>New Password</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputSlot>
                      <InputIcon as={Lock} />
                    </InputSlot>
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      secureTextEntry={!showNewPassword}
                      placeholder="New password"
                    />
                    <InputSlot onPress={() => setShowNewPassword((v) => !v)}>
                      <InputIcon as={showNewPassword ? EyeOff : Eye} />
                    </InputSlot>
                  </Input>
                  <FormControlError>
                    <FormControlErrorIcon as={AlertCircle} />
                    <FormControlErrorText>{passwordErrors.new_password?.message}</FormControlErrorText>
                  </FormControlError>
                </FormControl>
              )}
            />

            <Controller
              control={passwordControl}
              name="confirm_password"
              render={({ field: { value, onChange } }) => (
                <FormControl isInvalid={!!passwordErrors.confirm_password} isRequired>
                  <FormControlLabel>
                    <FormControlLabelText>Confirm New Password</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputSlot>
                      <InputIcon as={Lock} />
                    </InputSlot>
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      secureTextEntry={!showConfirmPassword}
                      placeholder="Confirm new password"
                    />
                    <InputSlot onPress={() => setShowConfirmPassword((v) => !v)}>
                      <InputIcon as={showConfirmPassword ? EyeOff : Eye} />
                    </InputSlot>
                  </Input>
                  <FormControlError>
                    <FormControlErrorIcon as={AlertCircle} />
                    <FormControlErrorText>{passwordErrors.confirm_password?.message}</FormControlErrorText>
                  </FormControlError>
                </FormControl>
              )}
            />

            {passwordAlert ? (
              <AppAlert
                title={passwordAlert.title}
                description={passwordAlert.description}
                action={passwordAlert.action}
                onClose={clearPasswordAlert}
              />
            ) : null}

            <Button
              size="lg"
              className="w-full rounded-xl bg-primary py-4"
              isDisabled={!passwordIsValid || changePasswordMutation.isPending}
              onPress={handleSubmitPassword(onSubmitPassword)}
            >
              <ButtonText className="uppercase tracking-widest">
                {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
              </ButtonText>
              {changePasswordMutation.isPending ? (
                <ButtonSpinner className="text-primary" />
              ) : null}
            </Button>
          </VStack>
        </Card>

        {/* Logout Card */}
        <Card size="sm" className="w-full rounded-2xl">
          <Button
            size="lg"
            variant="outline"
            className="w-full rounded-xl"
            onPress={() => logoutMutation.mutate()}
            isDisabled={logoutMutation.isPending}
          >
            <ButtonText>{logoutMutation.isPending ? 'Logging out...' : 'Logout'}</ButtonText>
            {logoutMutation.isPending ? <ButtonSpinner /> : <ButtonIcon as={LogOut} />}
          </Button>
        </Card>
      </ScrollView>
    </View>
  );
}