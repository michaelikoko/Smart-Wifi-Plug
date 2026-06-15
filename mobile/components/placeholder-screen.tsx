import { View } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';

import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Badge, BadgeText } from '@/components/ui/badge';

export function PlaceholderScreen({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-secondary px-8 dark:bg-background">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border">
        <Icon size={28} color="#737373" />
      </View>

      <VStack className="items-center gap-2">
        <Heading size="xl" className="text-center text-foreground">
          {title}
        </Heading>
        <Text className="max-w-xs text-center text-sm text-muted-foreground">
          {description}
        </Text>
      </VStack>

      <Badge className="rounded-full bg-secondary">
        <BadgeText>Coming Soon</BadgeText>
      </Badge>
    </View>
  );
}