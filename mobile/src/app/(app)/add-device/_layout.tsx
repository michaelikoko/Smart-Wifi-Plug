import { Stack } from 'expo-router';

export default function AddDeviceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="provision-device" />
      <Stack.Screen name="wifi-setup" />
    </Stack>
  );
}