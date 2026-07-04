import { AnimatedTabBar } from '@/components/animated-tab-bar';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, useRouter } from 'expo-router';

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
  const router = useRouter();

  const renderTabBar = (props: BottomTabBarProps) => (
    <AnimatedTabBar
      {...props}
      onScanMedicine={() => router.push('/scan-medicine')}
      onScanPrescription={() => router.push('/scan-prescription')}
      onAddMedicine={() => router.push('/add-medicine')}
      onAddSchedule={() => router.push('/add-schedule')}
    />
  );

  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
      {/* Abas visíveis na pill */}
      <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: TodayIcon }} />
      <Tabs.Screen name="medicines" options={{ title: 'Remédios', tabBarIcon: MedsIcon }} />
      <Tabs.Screen name="schedule" options={{ title: 'Agenda', tabBarIcon: ScheduleIcon }} />

      {/* Histórico: acessível via router.push */}
      <Tabs.Screen
        name="history"
        options={{ title: 'Histórico', tabBarIcon: HistoryIcon, href: null }}
      />
    </Tabs>
  );
}
