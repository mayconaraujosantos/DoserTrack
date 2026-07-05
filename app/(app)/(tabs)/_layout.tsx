import { QuickActionsSheet } from '@/components/quick-actions-sheet';
import { Feather, MaterialCommunityIcons, Octicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { AnimatedTabBar } from '../../../components/animated-tab-bar';

type IconProps = Readonly<{ color: string; size: number }>;

function TodayIcon({ color, size }: IconProps) {
  return <Octicons name="home" size={size} color={color} />;
}
function MedsIcon({ color, size }: IconProps) {
  return <MaterialCommunityIcons name="pill" size={size + 2} color={color} />;
}
function ScheduleIcon({ color, size }: IconProps) {
  return <MaterialCommunityIcons name="calendar-month-outline" size={size + 2} color={color} />;
}
function HistoryIcon({ color, size }: IconProps) {
  return <Feather name="bar-chart-2" size={size} color={color} />;
}

function renderTabBar(props: BottomTabBarProps) {
  return <TabBarShell {...props} />;
}

function TabBarShell(props: Readonly<BottomTabBarProps>) {
  const [showActions, setShowActions] = useState(false);

  return (
    <>
      <AnimatedTabBar {...props} onOpenActions={() => setShowActions(true)} />
      <QuickActionsSheet visible={showActions} onClose={() => setShowActions(false)} />
    </>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
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
  );
}
