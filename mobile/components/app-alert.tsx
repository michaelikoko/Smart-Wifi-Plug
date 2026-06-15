import { Alert, AlertText, AlertIcon } from '@/components/ui/alert';
import { Icon, CloseIcon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import {
  CheckCircle2, Info, AlertTriangle, XCircle,
} from 'lucide-react-native';

type AlertAction = 'error' | 'success' | 'warning' | 'info';

interface AppAlertProps {
  title: string;
  description?: string;
  action?: AlertAction;
  onClose?: () => void;
}

const ACTION_CONFIG: Record<AlertAction, {
  icon: typeof CheckCircle2;
  containerClass: string;
  iconClass: string;
  titleClass: string;
}>  = {
  error: {
    icon: XCircle,
    containerClass: 'bg-destructive/10 border-destructive/20',
    iconClass: 'text-destructive',
    titleClass: 'text-destructive',
  },
  success: {
    icon: CheckCircle2,
    containerClass: 'bg-success/10 border-success/20',
    iconClass: 'text-success',
    titleClass: 'text-success',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-warning/10 border-warning/20',
    iconClass: 'text-warning',
    titleClass: 'text-warning',
  },
  info: {
    icon: Info,
    containerClass: 'bg-info/10 border-info/20',
    iconClass: 'text-info',
    titleClass: 'text-info',
  },
};

export function AppAlert({
  title,
  description,
  action = 'error',
  onClose,
}: AppAlertProps) {
  const config = ACTION_CONFIG[action];

  return (
    <Alert className={`gap-3 items-start ${config.containerClass}`}>
      <AlertIcon
        as={config.icon}
        className={`mt-0.5 ${config.iconClass}`}
      />

      <AlertText className="flex-1 text-foreground/60">
        <AlertText className={`font-semibold ${config.titleClass}`}>
          {title}
          {description ? ':  ' : ''}
        </AlertText>
        {description}
      </AlertText>

      {onClose && (
        <Pressable onPress={onClose} className="mt-0.5">
          <Icon as={CloseIcon} className="text-foreground/50" />
        </Pressable>
      )}
    </Alert>
  );
}