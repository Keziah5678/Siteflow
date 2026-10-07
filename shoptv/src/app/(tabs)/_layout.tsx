import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/navigation/TabBar';
import { COLORS } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: COLORS.background }, animation: 'shift' }}
    >
      <Tabs.Screen name="home" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explorer' }} />
      <Tabs.Screen name="drops" options={{ title: 'Drops' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favoris' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
