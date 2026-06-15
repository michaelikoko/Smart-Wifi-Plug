import { Bell } from 'lucide-react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AlertsScreen() {
  return (
    <PlaceholderScreen
      icon={Bell}
      title="Alerts"
      description="Notifications about device status changes and system events will appear here."
    />
  );
}