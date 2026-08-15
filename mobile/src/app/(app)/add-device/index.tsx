import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, ArrowRight, Plus, PlugZap, Wifi } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { isAxiosError } from 'axios';

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
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { AppAlert } from '@/components/app-alert';

import { registerDevice, type DeviceRegisterRequest } from '../../../api/devices-api';

const addDeviceSchema = z.object({
  device_id: z.string().trim().min(1, 'Device ID is required'),
  name: z.string().trim().min(1, 'Device name is required'),
});

type AddDeviceFormData = z.infer<typeof addDeviceSchema>;

export default function AddDeviceScreen() {
  const router = useRouter();
  const [alert, setAlert] = useState<{
    title: string;
    description: string;
    action: 'error' | 'success' | 'warning' | 'info';
  } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<AddDeviceFormData>({
    resolver: zodResolver(addDeviceSchema),
    mode: 'onChange',
    defaultValues: {
      device_id: '',
      name: '',
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: DeviceRegisterRequest) => registerDevice(data),
    onSuccess: (device) => {
      reset();
      router.push({
        pathname: '/(app)/add-device/wifi-setup',
        params: { device_id: device.device_id },
      });
    },
    onError: (error) => {
      const message = {
        title: 'Add Device Failed',
        description: 'An unexpected error occurred. Please try again later.',
      };

      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          message.title = 'Device ID Not Found';
          message.description = "We couldn't find that device ID. Double check the ID printed on your plug.";
        } else if (status === 400) {
          message.title = 'Already Registered';
          message.description = 'This device is already registered to an account.';
        } else if (status === 500) {
          message.title = 'Server Error';
          message.description = 'Something went wrong on our end. Please try again later.';
        }
      }

      setAlert({
        title: message.title,
        description: message.description,
        action: 'error',
      });
    },
  });

  const onSubmit = (formData: AddDeviceFormData) => {
    setAlert(null);
    registerMutation.mutate({
      device_id: formData.device_id.trim(),
      name: formData.name.trim(),
    });
  };

  return (
    <View className="flex-1 bg-secondary dark:bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="flex-grow justify-center px-5 py-6"
      >
        <VStack className="mx-auto w-full max-w-sm gap-5">
          <HStack className="items-center justify-between px-1">
            <VStack className="gap-0.5">
              <Text className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Add Device
              </Text>
              <Heading size="lg" className="text-foreground">
                Register Plug
              </Heading>
            </VStack>

            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-card border border-border">
              <Plus size={20} color="#737373" />
            </View>
          </HStack>

          <Card size="default" className="w-full rounded-2xl">
            <VStack className="gap-6">
              <VStack className="items-center gap-4">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                  <PlugZap size={26} className="text-primary" strokeWidth={2.5} />
                </View>
                <VStack className="items-center gap-1.5">
                  <Heading size="xl" className="text-center text-foreground">
                    Add your smart plug
                  </Heading>
                  <Text className="text-center text-sm text-muted-foreground">
                    Enter the device ID printed on the plug, then give it a friendly name.
                  </Text>
                </VStack>
              </VStack>

              <Controller
                control={control}
                name="device_id"
                render={({ field: { value, onChange } }) => (
                  <FormControl isInvalid={!!errors.device_id} isRequired>
                    <FormControlLabel>
                      <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                        Device ID
                      </FormControlLabelText>
                    </FormControlLabel>
                    <Input className="rounded-xl">
                      <InputSlot className="pl-3">
                        <InputIcon as={Wifi} />
                      </InputSlot>
                      <InputField
                        value={value}
                        onChangeText={onChange}
                        placeholder="esp32-smartplug-XXXXXX"
                        autoCorrect={false}
                      />
                    </Input>
                    <FormControlError>
                      <FormControlErrorIcon as={AlertCircle} />
                      <FormControlErrorText>{errors.device_id?.message}</FormControlErrorText>
                    </FormControlError>
                  </FormControl>
                )}
              />

              <Controller
                control={control}
                name="name"
                render={({ field: { value, onChange } }) => (
                  <FormControl isInvalid={!!errors.name} isRequired>
                    <FormControlLabel>
                      <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                        Device Name
                      </FormControlLabelText>
                    </FormControlLabel>
                    <Input className="rounded-xl">
                      <InputSlot className="pl-3">
                        <InputIcon as={PlugZap} />
                      </InputSlot>
                      <InputField
                        value={value}
                        onChangeText={onChange}
                        placeholder="Living Room Plug"
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                    </Input>
                    <FormControlError>
                      <FormControlErrorIcon as={AlertCircle} />
                      <FormControlErrorText>{errors.name?.message}</FormControlErrorText>
                    </FormControlError>
                  </FormControl>
                )}
              />

              {alert ? (
                <AppAlert
                  title={alert.title}
                  description={alert.description}
                  action={alert.action}
                  onClose={() => setAlert(null)}
                />
              ) : null}

              <Button
                size="lg"
                className="w-full rounded-xl bg-primary py-4"
                isDisabled={!isValid || registerMutation.isPending}
                onPress={handleSubmit(onSubmit)}
              >
                <ButtonText className="uppercase tracking-widest">
                  {registerMutation.isPending ? 'Registering...' : 'Continue'}
                </ButtonText>
                {registerMutation.isPending ? (
                  <ButtonSpinner className="text-primary" />
                ) : (
                  <ButtonIcon as={ArrowRight} />
                )}
              </Button>
            </VStack>
          </Card>
        </VStack>
      </ScrollView>
    </View>
  );
}
