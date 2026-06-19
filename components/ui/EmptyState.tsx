import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type ViewProps } from 'react-native';

interface EmptyStateProps extends ViewProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
  ...rest
}: EmptyStateProps) {
  const C = useTheme();

  return (
    <View style={[styles.container, style]} {...rest}>
      <Ionicons name={icon} size={56} color={C.border} />
      <Text variant="body" color={C.sub} style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="caption" color={C.sub} style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="primary" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { textAlign: 'center' },
  description: { textAlign: 'center', lineHeight: 18 },
  action: { marginTop: 4 },
});
