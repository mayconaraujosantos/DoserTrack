import { useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedTabBar } from '@/components/animated-tab-bar';
import { QuickActionsSheet } from '@/components/quick-actions-sheet';

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
  const [showActions, setShowActions] = useState(false);

  return (
    <>
      <Tabs
        tabBar={props => <AnimatedTabBar {...props} onActionPress={() => setShowActions(true)} />}
        screenOptions={{ headerShown: false }}
      >
        {/* Abas visíveis na pill */}
        <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: TodayIcon }} />
        <Tabs.Screen name="medicines" options={{ title: 'Remédios', tabBarIcon: MedsIcon }} />
        <Tabs.Screen name="schedule" options={{ title: 'Agenda', tabBarIcon: ScheduleIcon }} />

        {/* Histórico: acessível via Quick Actions Sheet ou router.push */}
        <Tabs.Screen
          name="history"
          options={{ title: 'Histórico', tabBarIcon: HistoryIcon, href: null }}
        />
      </Tabs>

      <QuickActionsSheet visible={showActions} onClose={() => setShowActions(false)} />
    </>
  );
}
