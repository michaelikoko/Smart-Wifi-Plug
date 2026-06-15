import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, User } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';

import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from '@/components/ui/button';
import { Badge, BadgeText } from '@/components/ui/badge';

import { useAuthStore } from '../../store/auth-store';
import { logoutUser } from '../../api/auth-api';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      router.replace('/(auth)/login');
    },
  });

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-secondary px-8 dark:bg-background">
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

      <Badge className="rounded-full">
        <BadgeText>Coming Soon</BadgeText>
      </Badge>

      <Card size="sm" className="mt-2 w-full max-w-xs rounded-2xl">
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
    </View>
  );
}