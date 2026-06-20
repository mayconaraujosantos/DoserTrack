import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/hooks/use-theme';

type IconProps = Readonly<{ color: string; size: number }>;

function TodayIcon({ color, size }: IconProps) {
  return <Ionicons name="today-outline" size={size} color={color} />;
}
function MedsIcon({ color, size }: IconProps) {
  return <Ionicons name="medkit-outline" size={size} color={color} />;
}
function ScheduleIcon({ color, size }: IconProps) {
  return <Ionicons name="calendar-outline" size={size} color={color} />;
}
function HistoryIcon({ color, size }: IconProps) {
  return <Ionicons name="bar-chart-outline" size={size} color={color} />;
}

export default function TabLayout() {
  const C = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.sub,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.border,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: TodayIcon }} />
      <Tabs.Screen name="medicines" options={{ title: 'Remédios', tabBarIcon: MedsIcon }} />
      <Tabs.Screen name="schedule" options={{ title: 'Agenda', tabBarIcon: ScheduleIcon }} />
      <Tabs.Screen name="history" options={{ title: 'Histórico', tabBarIcon: HistoryIcon }} />
    </Tabs>
  );
}
