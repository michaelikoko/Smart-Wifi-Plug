import React from 'react';
import { Pressable, ScrollView, Text, TextInput, useColorScheme, View } from 'react-native';
import { Link } from 'expo-router';
import {
  ArrowRight,
  Bell,
  BarChart3,
  ChevronLeft,
  CircleCheck,
  CircleDot,
  LucideIcon,
  Home,
  PlugZap,
  Smartphone,
  Zap,
} from 'lucide-react-native';

export function cn(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ');
}

export function AppLogo({
  size = 'md',
  variant = 'brand',
}: {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'brand' | 'subtle';
}) {
  const frameSize = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-20 w-20' : 'h-14 w-14';
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 40 : 28;

  return (
    <View
      className={cn(
        frameSize,
        'items-center justify-center rounded-2xl border overflow-hidden',
        variant === 'brand'
          ? 'border-border bg-accent dark:border-border dark:bg-muted'
          : 'border-border bg-background dark:bg-card'
      )}
    >
      <View className="absolute inset-0 opacity-60">
        <View className="absolute -left-4 -top-4 h-10 w-10 rounded-full bg-muted dark:bg-muted" />
        <View className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-accent dark:bg-accent" />
      </View>
      <Zap size={iconSize} strokeWidth={2.5} className="text-primary" />
    </View>
  );
}

export function ScreenFrame({
  children,
  center = false,
  scroll = true,
}: {
  children: React.ReactNode;
  center?: boolean;
  scroll?: boolean;
}) {
  return (
    <View className="flex-1 bg-background">
      <View className="absolute inset-0">
        <View className="absolute -left-20 top-8 h-56 w-56 rounded-full bg-accent/60 blur-3xl" />
        <View className="absolute -right-24 top-48 h-64 w-64 rounded-full bg-muted/80 blur-3xl" />
        <View className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-card/60 blur-3xl" />
      </View>
      {scroll ? (
        <ScrollView
          className={cn('flex-1', center ? 'px-4 py-10' : 'px-4 py-6')}
          contentContainerClassName={cn(
            center ? 'flex-grow items-center justify-center py-8' : 'pb-10'
          )}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn('flex-1', center ? 'justify-center px-4 py-10' : 'px-4 py-6')}>
          {children}
        </View>
      )}
    </View>
  );
}

export function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn(
        'w-full rounded-3xl border border-border bg-card p-5',
        className
      )}
    >
      {children}
    </View>
  );
}

export function AppHeading({
  title,
  subtitle,
  align = 'center',
  compact = false,
}: {
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
  compact?: boolean;
}) {
  return (
    <View className={cn('gap-3', align === 'center' ? 'items-center text-center' : 'items-start')}>
      <AppLogo size={compact ? 'sm' : 'md'} />
      <View className={cn('gap-2', align === 'center' ? 'items-center' : 'items-start')}>
        <Text className="text-3xl font-extrabold tracking-tight text-foreground">
          {title}
        </Text>
        {subtitle ? (
          <Text className={cn(
            'max-w-md text-base leading-6 text-muted-foreground',
            align === 'center' ? 'text-center' : 'text-left'
          )}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function Field({
  label,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  rightIcon,
  prefixIcon,
}: {
  label: string;
  placeholder: string;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  secureTextEntry?: boolean;
  rightIcon?: React.ReactNode;
  prefixIcon?: React.ReactNode;
}) {
  const scheme = useColorScheme();
  const placeholderColor = scheme === 'dark' ? '#A1A1A1' : '#737373';

  return (
    <View className="gap-2">
      <Text className="text-[13px] font-semibold uppercase tracking-[0.24em] text-foreground">
        {label}
      </Text>
      <View className="flex-row items-center gap-3 rounded-xl border border-input bg-background px-4 py-3">
        {prefixIcon ? <View>{prefixIcon}</View> : null}
        <TextInput
          placeholder={placeholder}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          placeholderTextColor={placeholderColor}
          className="flex-1 text-base text-foreground"
        />
        {rightIcon ? <View>{rightIcon}</View> : null}
      </View>
    </View>
  );
}

export function PrimaryAction({
  children,
  href,
  onPress,
  iconRight = true,
  className,
}: {
  children: React.ReactNode;
  href?: Parameters<typeof Link>[0]['href'];
  onPress?: () => void;
  iconRight?: boolean;
  className?: string;
}) {
  const content = (
    <Pressable
      className={cn(
        'min-h-14 items-center justify-center rounded-xl bg-primary px-5 active:opacity-90',
        className
      )}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-3">
        <Text className="text-base font-bold tracking-[0.22em] text-primary-foreground uppercase">
          {children}
        </Text>
        {iconRight ? <ArrowRight size={18} className="text-primary-foreground" /> : null}
      </View>
    </Pressable>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        {content}
      </Link>
    );
  }

  return content;
}

export function GhostAction({
  children,
  href,
  onPress,
  leftIcon,
  className,
}: {
  children: React.ReactNode;
  href?: Parameters<typeof Link>[0]['href'];
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  className?: string;
}) {
  const content = (
    <Pressable
      className={cn(
        'min-h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background px-5',
        className
      )}
      onPress={onPress}
    >
      {leftIcon}
      <Text className="text-sm font-semibold text-foreground">
        {children}
      </Text>
    </Pressable>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        {content}
      </Link>
    );
  }

  return content;
}

export function SmallLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: Parameters<typeof Link>[0]['href'];
}) {
  return (
    <Link href={href} className="text-sm font-semibold text-primary">
      {children}
    </Link>
  );
}

export function TopBack({
  label,
  href,
}: {
  label: string;
  href: Parameters<typeof Link>[0]['href'];
  }) {
  return (
    <Link href={href} asChild>
      <Pressable className="flex-row items-center gap-3 self-start rounded-full border border-border bg-background px-4 py-2">
        <ChevronLeft size={18} className="text-muted-foreground" />
        <Text className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

export function CheckListItem({
  children,
  complete,
}: {
  children: React.ReactNode;
  complete?: boolean;
}) {
  const Icon = complete ? CircleCheck : CircleDot;

  return (
    <View className="flex-row items-center gap-3">
      <Icon
        size={18}
        className={complete ? 'text-primary' : 'text-muted-foreground'}
      />
      <Text className={cn(
        'text-sm',
        complete ? 'text-primary' : 'text-muted-foreground'
      )}>
        {children}
      </Text>
    </View>
  );
}

export function OtpBoxes({
  count = 6,
  activeIndex = 0,
}: {
  count?: number;
  activeIndex?: number;
}) {
  return (
    <View className="flex-row justify-center gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          className={cn(
            'h-14 w-14 items-center justify-center rounded-lg border bg-background',
            index === activeIndex
              ? 'border-primary ring-2 ring-ring/20'
              : 'border-border'
          )}
        >
          {index === activeIndex ? (
            <View className="h-10 w-px rounded-full bg-foreground" />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function SecurityMeter({
  label,
  state,
  ratio,
}: {
  label: string;
  state: string;
  ratio: number;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground">
          {label}
        </Text>
        <Text className="text-xs font-bold uppercase tracking-[0.2em] text-destructive">
          {state}
        </Text>
      </View>
      <View className="h-2 rounded-full bg-muted">
        <View
          className="h-2 rounded-full bg-destructive"
          style={{ width: `${Math.max(8, Math.min(100, ratio * 100))}%` }}
        />
      </View>
    </View>
  );
}

export function StatusPill({
  children,
  tone = 'green',
}: {
  children: React.ReactNode;
  tone?: 'green' | 'slate' | 'blue';
}) {
  const toneClasses =
    tone === 'green'
      ? 'bg-muted text-foreground'
      : tone === 'blue'
        ? 'bg-accent text-foreground'
        : 'bg-muted text-muted-foreground';

  return (
    <View className={cn('rounded-full px-3 py-1', toneClasses)}>
      <Text className="text-xs font-bold uppercase tracking-[0.18em]">{children}</Text>
    </View>
  );
}

export function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View className="min-w-[46%] flex-1 gap-2 rounded-2xl border border-border bg-background p-4">
      <Text className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </Text>
      <View className="flex-row items-end gap-2">
        <Text className="text-3xl font-black text-foreground">
          {value}
        </Text>
        {unit ? (
          <Text className="pb-1 text-sm font-semibold text-muted-foreground">
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function RelayRow({
  name,
  relay,
  active,
}: {
  name: string;
  relay: string;
  active?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-4">
      <View className="gap-1">
        <Text className="text-base font-bold text-foreground">{name}</Text>
        <Text className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {relay}
        </Text>
      </View>
      <View className={cn(
        'rounded-xl px-4 py-2',
        active
          ? 'bg-primary'
          : 'bg-muted'
      )}>
        <Text
          className={cn(
            'text-xs font-bold uppercase tracking-[0.2em]',
            active ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          {active ? 'On' : 'Off'}
        </Text>
      </View>
    </View>
  );
}

export function WeeklyBars() {
  const data = [
    { day: 'Mon', height: 38 },
    { day: 'Tue', height: 68 },
    { day: 'Wed', height: 92 },
    { day: 'Thu', height: 54 },
    { day: 'Fri', height: 78 },
    { day: 'Sat', height: 32 },
    { day: 'Sun', height: 46 },
  ];

  return (
    <View className="gap-4">
      <Text className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Weekly Consumption (kWh)
      </Text>
      <View className="h-52 flex-row items-end justify-between rounded-2xl border border-border bg-background px-3 py-4">
        {data.map((item, index) => (
          <View key={item.day} className="items-center gap-2">
            <View
              className={cn(
                'w-9 rounded-t-xl',
                index % 2 === 0 ? 'bg-primary' : 'bg-foreground'
              )}
              style={{ height: item.height }}
            />
            <Text className="text-[10px] font-medium text-muted-foreground">
              {item.day}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function BottomNav() {
  const items: Array<{
    label: string;
    icon: LucideIcon;
    active?: boolean;
    badge?: boolean;
  }> = [
    { label: 'Home', icon: Home, active: true },
    { label: 'Devices', icon: PlugZap },
    { label: 'Analytics', icon: BarChart3 },
    { label: 'Alerts', icon: Bell, badge: true },
    { label: 'Profile', icon: Smartphone },
  ];

  return (
    <View className="flex-row items-center justify-between border-t border-border bg-background px-3 py-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <View key={item.label} className="items-center gap-1 rounded-2xl px-3 py-2">
            <View className="relative">
              <Icon
                size={20}
                className={item.active ? 'text-primary' : 'text-muted-foreground'}
              />
              {item.badge ? (
                <View className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              ) : null}
            </View>
            <Text
              className={cn(
                'text-[11px] font-medium',
                item.active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
