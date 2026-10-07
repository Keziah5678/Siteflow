import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GradientButton, TextField, toast } from '@/components/ui';
import { COLORS, LAYOUT, RADIUS, SPACING } from '@/constants/theme';
import { useAddReview } from '@/features/social/hooks';

export function ReviewSheet({ productId, visible, onClose }: { productId: string; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const add = useAddReview(productId);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const submit = () =>
    add.mutate(
      { rating, title: title.trim(), body: body.trim() },
      {
        onSuccess: () => {
          toast('Merci pour ton avis !', 'success');
          setTitle('');
          setBody('');
          onClose();
        },
        onError: (e) => toast(e instanceof Error ? e.message : 'Erreur', 'error'),
      },
    );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Animated.View entering={SlideInDown.springify().damping(20)} style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <AppText variant="h3">Donner mon avis</AppText>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable key={i} onPress={() => setRating(i)} hitSlop={6} accessibilityLabel={`${i} étoiles`}>
                  <Ionicons name={i <= rating ? 'star' : 'star-outline'} size={34} color={COLORS.star} />
                </Pressable>
              ))}
            </View>
            <TextField label="Titre" value={title} onChangeText={setTitle} placeholder="En un mot…" maxLength={80} />
            <TextField label="Ton avis" value={body} onChangeText={setBody} placeholder="Qu’as-tu pensé du produit ?" multiline maxLength={2000} style={styles.multiline} />
            <GradientButton label="Publier" icon="send" loading={add.isPending} onPress={submit} disabled={!body.trim()} />
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.scrim },
  kav: { width: '100%', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    padding: SPACING.screen,
    gap: SPACING.md,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  stars: { flexDirection: 'row', gap: SPACING.sm, marginVertical: SPACING.xs },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});
