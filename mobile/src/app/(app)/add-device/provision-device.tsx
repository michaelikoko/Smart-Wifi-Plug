import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, ArrowRight, RefreshCw, Wifi } from 'lucide-react-native';
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
import { FormScreen } from '@/components/app-ui';

import { getDevice } from '../../../api/devices-api';

const provisionDeviceSchema = z.object({
  device_id: z.string().trim().min(1, 'Device ID is required'),
});

type ProvisionDeviceFormData = z.infer<typeof provisionDeviceSchema>;

export default function ProvisionDeviceScreen() {
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
  } = useForm<ProvisionDeviceFormData>({
    resolver: zodResolver(provisionDeviceSchema),
    mode: 'onChange',
    defaultValues: {
      device_id: '',
    },
  });

  const provisionMutation = useMutation({
    mutationFn: (deviceId: string) => getDevice(deviceId),
    onSuccess: (device) => {
      reset();
      router.push({
        pathname: '/(app)/add-device/wifi-setup',
        params: { device_id: device.device_id },
      });
    },
    onError: (error) => {
      const message = {
        title: "Device Not Found or Not Owned",
        description: "We couldn't find that device ID under your account. Double-check the ID, or use Add Device if this is a brand new plug.",
      };

      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          message.title = "Device Not Found or Not Owned";
          message.description = "We couldn't find that device ID under your account. Double-check the ID, or use Add Device if this is a brand new plug.";
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

  const onSubmit = (formData: ProvisionDeviceFormData) => {
    setAlert(null);
    provisionMutation.mutate(formData.device_id.trim());
  };

  return (
    <View className="flex-1 bg-secondary dark:bg-background">
      <FormScreen
        showsVerticalScrollIndicator={false}
        contentContainerClassName="flex-grow justify-center px-5 py-6"
      >
        <VStack className="mx-auto w-full max-w-sm gap-5">
          <HStack className="items-center justify-between px-1">
            <VStack className="gap-0.5">
              <Text className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Provision Device
              </Text>
              <Heading size="lg" className="text-foreground">
                Re-add Plug
              </Heading>
            </VStack>

            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-card border border-border">
              <RefreshCw size={20} color="#737373" />
            </View>
          </HStack>

          <Card size="default" className="w-full rounded-2xl">
            <VStack className="gap-6">
              <VStack className="items-center gap-4">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                  <Wifi size={26} className="text-primary" strokeWidth={2.5} />
                </View>
                <VStack className="items-center gap-1.5">
                  <Heading size="xl" className="text-center text-foreground">
                    Re-add your smart plug
                  </Heading>
                  <Text className="text-center text-sm text-muted-foreground">
                    Use this if you&apos;re setting up a plug that lost its WiFi settings after a reset, or if WiFi setup was interrupted.
                  </Text>
                </VStack>
              </VStack>

              <VStack className="items-center gap-3 rounded-2xl border border-border bg-secondary px-4 py-5">
                <Text className="text-center text-xs leading-5 text-muted-foreground">
                  The device must already be registered to your account. If you haven&apos;t registered this plug yet, use{' '}
                  <Text className="font-semibold">Add Device</Text> instead.
                </Text>
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
                isDisabled={!isValid || provisionMutation.isPending}
                onPress={handleSubmit(onSubmit)}
              >
                <ButtonText className="uppercase tracking-widest">
                  {provisionMutation.isPending ? 'Looking up...' : 'Continue'}
                </ButtonText>
                {provisionMutation.isPending ? (
                  <ButtonSpinner className="text-primary" />
                ) : (
                  <ButtonIcon as={ArrowRight} />
                )}
              </Button>
            </VStack>
          </Card>
        </VStack>
      </FormScreen>
    </View>
  );
}
