import { PlugZap } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function DevicesScreen() {
  return (
    <PlaceholderScreen
      icon={PlugZap}
      title="Devices"
      description="Manage and monitor connected relays and smart plugs from here."
    />
  );
}