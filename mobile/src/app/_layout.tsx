import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import '@/src/global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSegments } from 'expo-router';
import { useAuthStore } from '../store/auth-store';
import { useEffect } from 'react';


function AuthGuard() {
  /* Runs on every route change. Redirects to login when unauthenticated and trying to access a protected (app) route, or to home when authenticated and still on an auth route. */
  const router = useRouter();
  const segments = useSegments();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!accessToken && inAppGroup) {
      // Not logged in but trying to reach a protected screen → login
      router.replace('/(auth)/login');
    } else if (accessToken && inAuthGroup) {
      // Already logged in but on an auth screen → home
      router.replace('/(app)/home');
    }
  }, [accessToken, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  let mode: 'light' | 'dark' | 'system' = 'system';
  if (colorScheme === 'dark') {
    mode = 'dark';
  } else if (colorScheme === 'light') {
    mode = 'light';
  }


  // Add network status listener to refetch queries on reconnect later
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 1000 * 60 * 5 },
      mutations: { retry: 0 },
    },
  });
  ;
  return (
    <QueryClientProvider client={queryClient}>
      <GluestackUIProvider mode={mode}>
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }} />
      </GluestackUIProvider>
    </QueryClientProvider>
  );
}