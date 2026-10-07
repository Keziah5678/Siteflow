import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Unbounded_700Bold } from '@expo-google-fonts/unbounded/700Bold';
import { Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded/800ExtraBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider, type Theme } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui';
import { COLORS } from '@/constants/theme';
import { queryClient } from '@/lib/query';
import { initAuth } from '@/services/auth';
import { registerForPushNotifications } from '@/services/notifications';
import { clearUserData, syncUserData } from '@/services/user-data';
import { useSession } from '@/store/session';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.primaryBright,
    background: COLORS.background,
    card: COLORS.backgroundSecondary,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.fuchsia,
  },
};

/** Synchronise les données utilisateur à chaque changement de session. */
function useSessionEffects() {
  useEffect(() => initAuth(), []);
  useEffect(
    () =>
      useSession.subscribe((state, prev) => {
        if (state.status === 'signedIn' && state.userId && state.userId !== prev.userId) {
          if (!state.isDemo) {
            syncUserData(state.userId).catch(() => undefined);
            registerForPushNotifications().catch(() => undefined);
          }
          queryClient.invalidateQueries();
        }
        if (prev.status === 'signedIn' && state.status === 'signedOut') {
          clearUserData();
          queryClient.clear();
        }
      }),
    [],
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
  });
  useSessionEffects();

  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={theme}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="feed/[id]" options={{ animation: 'fade_from_bottom', presentation: 'fullScreenModal' }} />
              <Stack.Screen name="search" options={{ animation: 'fade' }} />
              <Stack.Screen name="(auth)/login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="(auth)/register" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="admin" options={{ animation: 'slide_from_bottom' }} />
            </Stack>
            <ToastHost />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
});
