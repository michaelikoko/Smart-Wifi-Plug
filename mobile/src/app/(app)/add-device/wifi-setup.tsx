import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  PlugZap,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Badge, BadgeText } from '@/components/ui/badge';
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
import { Spinner } from '@/components/ui/spinner';

import { getDevice } from '../../../api/devices-api';
import { submitWifiCredentials } from '../../../api/provisioning-api';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60_000;

const wifiSetupSchema = z.object({
  ssid: z.string().trim().min(1, 'Home WiFi SSID is required'),
  password: z.string().min(1, 'WiFi password is required'),
});

type WifiSetupFormData = z.infer<typeof wifiSetupSchema>;

type ScreenStep = 'instructions' | 'form' | 'polling' | 'success' | 'timeout' | 'error';

function normalizeParam(param: string | string[] | undefined): string | undefined {
  if (typeof param === 'string') return param;
  if (Array.isArray(param)) return param[0];
  return undefined;
}

export default function WifiSetupScreen() {
  const router = useRouter();
  const deviceId = normalizeParam(useLocalSearchParams<{ device_id?: string | string[] }>().device_id);

  const [step, setStep] = useState<ScreenStep>('instructions');
  const [showPassword, setShowPassword] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<WifiSetupFormData>({
    resolver: zodResolver(wifiSetupSchema),
    mode: 'onChange',
    defaultValues: {
      ssid: '',
      password: '',
    },
  });

  const provisionMutation = useMutation({
    mutationFn: ({ ssid, password }: WifiSetupFormData) => submitWifiCredentials(ssid, password),
    onSuccess: ({ status }) => {
      if (status === 'failed') {
        setStep('error');
        return;
      }

      setPollAttempt((attempt) => attempt + 1);
      setPollStartedAt(Date.now());
      setStep('polling');
    },
  });

  const deviceQuery = useQuery({
    queryKey: ['wifi-setup-device', deviceId, pollAttempt],
    queryFn: () => getDevice(deviceId as string),
    enabled: step === 'polling' && !!deviceId,
    refetchInterval: (query) => {
      if (step !== 'polling' || !pollStartedAt) return false;
      if (query.state.data?.is_online) return false;
      if (Date.now() - pollStartedAt >= POLL_TIMEOUT_MS) return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: true,
    retry: false,
  });

  const isDeviceOnline = step === 'polling' && deviceQuery.data?.is_online === true;
  const activeStep: ScreenStep = isDeviceOnline ? 'success' : step;

  useEffect(() => {
    if (step !== 'polling' || !pollStartedAt || isDeviceOnline) return undefined;

    const timeout = setTimeout(() => {
      setStep((currentStep) => (currentStep === 'polling' ? 'timeout' : currentStep));
      setPollStartedAt(null);
    }, POLL_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [step, pollStartedAt, isDeviceOnline]);

  const onSubmit = (data: WifiSetupFormData) => {
    provisionMutation.mutate({ ssid: data.ssid.trim(), password: data.password });
  };

  const resetToForm = () => {
    setStep('form');
    setPollStartedAt(null);
    setShowPassword(false);
    provisionMutation.reset();
  };

  // NEW: Allows checking again without wiping the form state
  const restartPolling = () => {
    setPollAttempt((attempt) => attempt + 1);
    setPollStartedAt(Date.now());
    setStep('polling');
  };

  const renderContent = () => {
    if (!deviceId) {
      return (
        <Card size="default" className="w-full rounded-2xl">
          <VStack className="items-center gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertCircle size={24} color="#E7000B" />
            </View>
            <VStack className="items-center gap-2">
              <Heading size="lg" className="text-center text-foreground">
                Missing device ID
              </Heading>
              <Text className="text-center text-sm text-muted-foreground">
                We could not find the device identifier for this setup screen.
              </Text>
            </VStack>
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-xl py-4"
              onPress={() => router.replace('/(app)/devices')}
            >
              <ButtonIcon as={ArrowLeft} />
              <ButtonText>Back to devices</ButtonText>
            </Button>
          </VStack>
        </Card>
      );
    }

    if (activeStep === 'instructions') {
      return (
        <Card size="default" className="w-full rounded-2xl">
          <VStack className="gap-6">
            <VStack className="items-center gap-4">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
                <PlugZap size={26} className="text-primary" strokeWidth={2.5} />
              </View>
              <VStack className="items-center gap-1.5">
                <Heading size="xl" className="text-center text-foreground">
                  Add Device
                </Heading>
                <Text className="text-center text-sm text-muted-foreground">
                  We&apos;ll connect your smart plug to your home WiFi.
                </Text>
              </VStack>
            </VStack>

            <VStack className="items-center gap-3 rounded-2xl border border-border bg-secondary px-4 py-5">
              <Text className="text-center text-sm leading-6 text-foreground">
                Look for a WiFi network named SmartPlug-XXXXXX on your device&apos;s label.
                Join it in your phone&apos;s WiFi settings using the password shown on the label, then come back here.
              </Text>
            </VStack>

            <Button
              size="lg"
              className="w-full rounded-xl bg-primary py-4"
              onPress={() => setStep('form')}
            >
              <ButtonText className="uppercase tracking-widest">
                I&apos;ve joined it
              </ButtonText>
              <ButtonIcon as={ArrowRight} />
            </Button>
          </VStack>
        </Card>
      );
    }

    if (activeStep === 'form') {
      return (
        <Card size="default" className="w-full rounded-2xl">
          <VStack className="gap-6">
            <VStack className="items-center gap-3">
              <Badge className="rounded-full">
                <BadgeText className="font-mono">{deviceId}</BadgeText>
              </Badge>
              <VStack className="items-center gap-1.5">
                <Heading size="xl" className="text-center text-foreground">
                  Home WiFi Details
                </Heading>
                <Text className="text-center text-sm text-muted-foreground">
                  Enter the network your plug should join.
                </Text>
              </VStack>
            </VStack>

            <Controller
              control={control}
              name="ssid"
              render={({ field: { value, onChange } }) => (
                <FormControl isInvalid={!!errors.ssid} isRequired>
                  <FormControlLabel>
                    <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                      Home WiFi SSID
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Input className="rounded-xl">
                    <InputSlot className="pl-3">
                      <InputIcon as={Wifi} />
                    </InputSlot>
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      placeholder="Your home network name"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </Input>
                  <FormControlError>
                    <FormControlErrorIcon as={AlertCircle} />
                    <FormControlErrorText>{errors.ssid?.message}</FormControlErrorText>
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
                    <FormControlLabelText className="text-[11px] font-bold uppercase tracking-widest">
                      WiFi Password
                    </FormControlLabelText>
                  </FormControlLabel>
                  <Input className="rounded-xl">
                    <InputSlot className="pl-3">
                      <InputIcon as={Lock} />
                    </InputSlot>
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      placeholder="Enter network password"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <InputSlot
                      className="pr-3"
                      onPress={() => setShowPassword((current) => !current)}
                    >
                      <InputIcon as={showPassword ? EyeOff : Eye} />
                    </InputSlot>
                  </Input>
                  <FormControlError>
                    <FormControlErrorIcon as={AlertCircle} />
                    <FormControlErrorText>{errors.password?.message}</FormControlErrorText>
                  </FormControlError>
                </FormControl>
              )}
            />

            <VStack className="gap-3">
              <Button
                size="lg"
                className="w-full rounded-xl bg-primary py-4"
                isDisabled={!isValid || provisionMutation.isPending}
                onPress={handleSubmit(onSubmit)}
              >
                <ButtonText className="uppercase tracking-widest">
                  {provisionMutation.isPending ? 'Connecting...' : 'Connect Plug'}
                </ButtonText>
                {provisionMutation.isPending ? <ButtonSpinner className="text-primary" /> : <ButtonIcon as={ArrowRight} />}
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-xl py-4"
                onPress={() => setStep('instructions')}
                isDisabled={provisionMutation.isPending}
              >
                <ButtonIcon as={ArrowLeft} />
                <ButtonText>Back</ButtonText>
              </Button>
            </VStack>
          </VStack>
        </Card>
      );
    }

    if (activeStep === 'polling') {
      return (
        <Card size="default" className="w-full rounded-2xl">
          <VStack className="items-center gap-5 py-2">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Spinner size="small" />
            </View>
            <VStack className="items-center gap-2">
              <Heading size="lg" className="text-center text-foreground">
                Finishing setup...
              </Heading>
              <Text className="text-center text-sm text-muted-foreground">
                We&apos;re checking whether the plug is online on your home WiFi.
              </Text>
            </VStack>
            <Text className="text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              This can take up to 60 seconds
            </Text>
          </VStack>
        </Card>
      );
    }

    if (activeStep === 'success') {
      return (
        <Card size="default" className="w-full rounded-2xl">
          <VStack className="items-center gap-5 py-2">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
              <CheckCircle2 size={28} color="#10b981" />
            </View>
            <VStack className="items-center gap-2">
              <Heading size="lg" className="text-center text-foreground">
                Setup complete
              </Heading>
              <Text className="text-center text-sm text-muted-foreground">
                The plug is online and ready to use.
              </Text>
            </VStack>
            <Button
              size="lg"
              className="w-full rounded-xl bg-primary py-4"
              onPress={() => router.replace('/(app)/devices')}
            >
              <ButtonText className="uppercase tracking-widest">
                Done
              </ButtonText>
              <ButtonIcon as={ArrowRight} />
            </Button>
          </VStack>
        </Card>
      );
    }

    if (activeStep === 'error') {
      return (
        <Card size="default" className="w-full rounded-2xl">
          <VStack className="items-center gap-5 py-2">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <WifiOff size={28} color="#E7000B" />
            </View>
            <VStack className="items-center gap-2">
              <Heading size="lg" className="text-center text-foreground">
                Setup failed
              </Heading>
              <Text className="text-center text-sm text-muted-foreground">
                Incorrect WiFi network or password. Please check the details and try again.
              </Text>
            </VStack>
            <Button
              size="lg"
              className="w-full rounded-xl bg-primary py-4"
              onPress={resetToForm}
            >
              <ButtonText className="uppercase tracking-widest">
                Try again
              </ButtonText>
              <ButtonIcon as={ArrowRight} />
            </Button>
          </VStack>
        </Card>
      );
    }

    return (
      <Card size="default" className="w-full rounded-2xl">
        <VStack className="items-center gap-5 py-2">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <WifiOff size={28} color="#E7000B" />
          </View>
          <VStack className="items-center gap-2">
            <Heading size="lg" className="text-center text-foreground">
              Couldn&apos;t confirm connection
            </Heading>
            <Text className="text-center text-sm text-muted-foreground">
              The plug didn&apos;t report online within our time window. If you just switched networks, it might just need another look.
            </Text>
          </VStack>
          <VStack className="w-full gap-3">
            <Button
              size="lg"
              className="w-full rounded-xl bg-primary py-4"
              onPress={restartPolling}
            >
              <ButtonText className="uppercase tracking-widest">
                Check Again
              </ButtonText>
              <ButtonIcon as={ArrowRight} />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-xl py-4"
              onPress={resetToForm}
            >
              <ButtonText>Enter Details Again</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </Card>
    );
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
              WiFi Setup
            </Heading>
          </VStack>

          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-card border border-border">
            <PlugZap size={20} color="#737373" />
          </View>
        </HStack>

        {renderContent()}
      </VStack>
    </ScrollView>
  </View>
);
}

/*
      <Card size="default" className="w-full rounded-2xl">
        <VStack className="items-center gap-5 py-2">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <WifiOff size={28} color="#E7000B" />
          </View>
          <VStack className="items-center gap-2">
            <Heading size="lg" className="text-center text-foreground">
              Couldn&apos;t confirm connection
            </Heading>
            <Text className="text-center text-sm text-muted-foreground">
              The plug did not report online within our time window.
            </Text>
          </VStack>
          <VStack className="w-full gap-3">
            <Button
              size="lg"
              className="w-full rounded-xl bg-primary py-4"
              onPress={resetToForm}
            >
              <ButtonText className="uppercase tracking-widest">
                Try again
              </ButtonText>
              <ButtonIcon as={ArrowRight} />
            </Button>
          </VStack>
        </VStack>
      </Card>
*/