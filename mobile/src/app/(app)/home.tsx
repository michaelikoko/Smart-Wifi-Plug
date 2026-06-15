import { ScrollView, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, CheckCircle2, CircleX, LogOut, PlugZap, Zap } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Badge, BadgeText } from '@/components/ui/badge';

import { BottomNav, MetricCard, RelayRow, WeeklyBars } from '@/components/app-ui';
import { useAuthStore } from '../../store/auth-store';
import { logoutUser, getMe } from '../../api/auth-api';
import { Button, ButtonSpinner } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useEffect } from 'react';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const storedUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const { data: user, refetch, isRefetching } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    initialData: storedUser ?? undefined,
  })

  // Sync any changes to user data from the server back to the store.
  //if (user && user !== storedUser) setUser(user);
  useEffect(() => {
    if (user) {
      setUser(user);
    }
  }, [user, setUser]);

  const firstName = user?.full_name?.split(' ')[0] ?? 'User';

  const onRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['me'] });
    await refetch();
  }

  // Revoke refresh token on the server, then clear local state
  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      // Always redirect regardless of server response —
      // logoutUser() already cleared the store before this fires.
      router.replace('/(auth)/login');
    },
  });

  if (!storedUser) {
    // Fetching user, show a brief placeholder UI.
    return (
      <View className="flex-1 items-center justify-center bg-secondary">
          <Spinner size="large" color="grey" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-secondary">

      <HStack className="items-center justify-between border-b border-border bg-card px-5 pb-3 pt-14">
        <HStack className="items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Zap size={18} className='text-primary' strokeWidth={2.5} />
          </View>
          <VStack className="gap-0">
            <Text className="text-[17px] font-extrabold text-foreground">SmartPlug</Text>
            <Text className="text-[11px] text-muted-foreground">Industrial energy control</Text>
          </VStack>
        </HStack>

        <HStack className="items-center gap-2">
          <Button className="relative h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <Bell size={20} color="#171717" />
            <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          </Button>

          <Button
            className="h-10 w-10 items-center justify-center rounded-xl bg-secondary"
            onPress={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending
              ? <ButtonSpinner size="small" />
              : <LogOut size={18} color="#737373" />}
          </Button>
        </HStack>
      </HStack>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 py-5 gap-4 pb-6"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor="#171717"
            colors={['#171717']}
            progressBackgroundColor="#ffffff"
          />
        }
      >
        <VStack className="gap-0.5 px-1">
          <Heading size="xl" className="text-foreground">Hello, {firstName}</Heading>
          <Text className="text-[13px] text-muted-foreground">System is operating normally.</Text>
        </VStack>

        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <HStack className="items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                System Overview
              </Text>
              <Badge variant='secondary' className="rounded-full">
                <BadgeText>Optimal</BadgeText>
              </Badge>
            </HStack>
            <HStack className="gap-3">
              <MetricCard label="Current Load" value="4.2" unit="kW" />
              <MetricCard label="Energy Today" value="12.8" unit="kWh" />
            </HStack>
          </VStack>
        </Card>

        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Device Status
            </Text>
            <VStack className="gap-2">
              <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3.5">
                <HStack className="items-center gap-2.5">
                  <CheckCircle2 size={17} color="#10b981" />
                  <Text className="text-[13px] text-foreground">Online Devices</Text>
                </HStack>
                <Text className="text-[15px] font-bold text-foreground">3</Text>
              </HStack>
              <HStack className="items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3.5">
                <HStack className="items-center gap-2.5">
                  <CircleX size={17} color="#9ca3af" />
                  <Text className="text-[13px] text-foreground">Offline Devices</Text>
                </HStack>
                <Text className="text-[15px] font-bold text-foreground">0</Text>
              </HStack>
            </VStack>
          </VStack>
        </Card>

        <Card size="sm" className="w-full rounded-2xl">
          <WeeklyBars />
        </Card>

        <Card size="sm" className="w-full rounded-2xl">
          <VStack className="gap-3">
            <HStack className="items-center justify-between">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Relay Control
              </Text>
              <HStack className="items-center gap-1.5">
                <PlugZap size={14} color="#171717" />
                <Text className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                  2 Active
                </Text>
              </HStack>
            </HStack>
            <VStack className="gap-2.5">
              <RelayRow name="Main Server Room" relay="Relay 1" active />
              <RelayRow name="Floor 2 Lighting" relay="Relay 2" />
            </VStack>
          </VStack>
        </Card>
      </ScrollView>
    </View>
  );
}
