import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useColorScheme, type ColorValue } from 'react-native';
import { Home, PlugZap, BarChart3, Bell, User, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  light: {
    active: '#171717',     // --primary
    inactive: '#737373',   // --muted-foreground
    background: '#FFFFFF', // --card
    border: '#E5E5E5',     // --border
  },
  dark: {
    active: '#FFF5F5',     // --primary
    inactive: '#A1A1A1',   // --muted-foreground
    background: '#171717', // --card
    border: '#2E2E2E',     // --border
  },
} as const;

function TabIcon({ icon: Icon, color, showDot = false }: {
  icon: LucideIcon;
  color: ColorValue;
  showDot?: boolean;
}) {
  return (
    <View style={{ position: 'relative' }}>
      <Icon size={22} color={color} />
      {showDot ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -3,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#E7000B', // --destructive (light)
          }}
        />
      ) : null}
    </View>
  );
}

export default function AppTabsLayout() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const c = COLORS[mode];

  const insets = useSafeAreaInsets(); 
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.active,
        tabBarInactiveTintColor: c.inactive,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 10 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon icon={Home} color={color} />,
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Devices',
          tabBarIcon: ({ color }) => <TabIcon icon={PlugZap} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <TabIcon icon={BarChart3} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <TabIcon icon={Bell} color={color} showDot />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon icon={User} color={color} />,
        }}
      />
    </Tabs>
  );
}