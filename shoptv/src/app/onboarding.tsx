import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppImage, AppText, GradientButton, Logo } from '@/components/ui';
import { ANIMATIONS, COLORS, FONTS, GRADIENTS, SPACING } from '@/constants/theme';
import { unsplash } from '@/lib/media';
import { useLibrary } from '@/store/library';

const SLIDES = [
  {
    key: 'watch',
    title: 'Regarde.\nCraque.\nCommande.',
    body: 'Découvre les produits en vidéo, comme une série que tu ne veux pas arrêter.',
    image: unsplash('1606813907291-d86efa9b94db', 1000),
  },
  {
    key: 'drops',
    title: 'Des Drops\nà ne pas\nmanquer.',
    body: 'Chaque jour, des produits d’exception à prix réduit pendant quelques heures seulement.',
    image: unsplash('1542291026-7eec264c27ff', 1000),
  },
  {
    key: 'foryou',
    title: 'Un flux\nqui te\nressemble.',
    body: 'Plus tu regardes, plus « Pour toi » devient personnel. Sans compte pour commencer.',
    image: unsplash('1592750475338-74b7b21085ab', 1000),
  },
];

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 26 : 8, ANIMATIONS.spring),
    opacity: withSpring(active ? 1 : 0.35),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export default function OnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const complete = useLibrary((s) => s.completeOnboarding);

  const finish = (to: '/home' | '/login') => {
    complete();
    router.replace('/home');
    if (to === '/login') router.push('/login');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(s) => s.key}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <AppImage uri={item.image} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={GRADIENTS.scrimBottom} locations={[0.1, 0.5, 0.78]} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={[COLORS.primaryHaze, 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 0.8, y: 0.4 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.copy, { paddingBottom: insets.bottom + 150 }]}>
              <AppText style={styles.title}>{item.title}</AppText>
              <AppText variant="body" color={COLORS.textSecondary} style={styles.body}>
                {item.body}
              </AppText>
            </View>
          </View>
        )}
      />

      <View style={[styles.header, { top: insets.top + SPACING.md }]}>
        <Logo size={22} />
        <AppText variant="bodyMedium" color={COLORS.textSecondary} onPress={() => finish('/home')}>
          Passer
        </AppText>
      </View>

      <Animated.View entering={FadeInDown.delay(200)} style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Dot key={s.key} active={i === index} />
          ))}
        </View>
        <GradientButton
          pulse
          label={index === SLIDES.length - 1 ? 'Commencer' : 'Suivant'}
          icon={index === SLIDES.length - 1 ? 'sparkles' : 'arrow-forward'}
          onPress={() => (index < SLIDES.length - 1 ? listRef.current?.scrollToIndex({ index: index + 1 }) : finish('/home'))}
        />
        <AppText variant="caption" color={COLORS.textSecondary} align="center" style={styles.login} onPress={() => finish('/login')}>
          Déjà membre ? <AppText variant="caption" color={COLORS.link}>Se connecter</AppText>
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { position: 'absolute', left: SPACING.screen, right: SPACING.screen, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  copy: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: SPACING.screen + 4, maxWidth: 560 },
  title: { fontFamily: FONTS.display, fontSize: 34, lineHeight: 42, color: COLORS.text },
  body: { marginTop: SPACING.md, fontSize: 16, lineHeight: 23 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SPACING.screen, gap: SPACING.lg, maxWidth: 560, alignSelf: 'center', width: '100%' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 8, borderRadius: 4, backgroundColor: COLORS.primaryBright },
  login: { marginTop: -4 },
});
