import { Zap } from 'lucide-react-native';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

export function StatTile({
    icon: Icon,
    label,
    value,
    unit,
    iconColor = '#737373',
    valueColor,
}: {
    icon: typeof Zap;
    label: string;
    value: string;
    unit?: string;
    iconColor?: string;
    valueColor?: string;
}) {
    return (
        <VStack className="flex-1 gap-2 rounded-xl border border-border bg-secondary p-3.5 min-w-[45%]">
            <HStack className="items-center gap-1.5">
                <Icon size={14} color={iconColor} />
                <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {label}
                </Text>
            </HStack>
            <HStack className="items-end gap-1">
                <Text
                    className="text-2xl font-black text-foreground"
                    style={valueColor ? { color: valueColor } : undefined}
                >
                    {value}
                </Text>
                {unit ? (
                    <Text className="mb-0.5 text-[12px] font-semibold text-muted-foreground">{unit}</Text>
                ) : null}
            </HStack>
        </VStack>
    );
}