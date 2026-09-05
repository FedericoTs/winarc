import { Tabs } from 'expo-router';
import { colors, fonts } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.ground, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.ice,
        tabBarInactiveTintColor: colors.ink3,
        tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="squad" options={{ title: 'Squad' }} />
      <Tabs.Screen name="ledger" options={{ title: 'Ledger' }} />
      <Tabs.Screen name="arc" options={{ title: 'Arc' }} />
    </Tabs>
  );
}
