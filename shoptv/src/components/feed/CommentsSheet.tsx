import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, PressableScale, toast } from '@/components/ui';
import { COLORS, FONTS, LAYOUT, RADIUS, SPACING } from '@/constants/theme';
import { useAddComment, useComments } from '@/features/social/hooks';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { formatCount, formatRelative } from '@/lib/format';

interface Props {
  productId: string;
  count: number;
  visible: boolean;
  onClose: () => void;
}

export function CommentsSheet({ productId, count, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const comments = useComments(productId, visible);
  const add = useAddComment(productId);
  const requireAuth = useRequireAuth();
  const [text, setText] = useState('');

  const submit = () =>
    requireAuth(() => {
      if (!text.trim()) return;
      add.mutate(text, {
        onSuccess: () => setText(''),
        onError: (e) => toast(e instanceof Error ? e.message : 'Erreur', 'error'),
      });
    }, 'comment');

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer les commentaires" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Animated.View entering={SlideInDown.springify().damping(20)} style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <AppText variant="title">{formatCount(count)} commentaires</AppText>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>
            {comments.isLoading ? (
              <ActivityIndicator color={COLORS.primaryBright} style={styles.loader} />
            ) : (
              <FlatList
                data={comments.data ?? []}
                keyExtractor={(c) => c.id}
                style={styles.list}
                ListEmptyComponent={
                  <AppText variant="caption" color={COLORS.textSecondary} align="center" style={styles.loader}>
                    Sois le premier à commenter ✨
                  </AppText>
                }
                renderItem={({ item }) => (
                  <View style={styles.comment}>
                    <View style={styles.avatar}>
                      <AppText style={styles.avatarText}>{item.authorName.slice(0, 1).toUpperCase()}</AppText>
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="small" color={COLORS.textSecondary}>
                        {item.authorName} · {formatRelative(item.createdAt)}
                      </AppText>
                      <AppText variant="body" style={styles.body}>
                        {item.body}
                      </AppText>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Ajouter un commentaire…"
                placeholderTextColor={COLORS.textMuted}
                maxLength={500}
                style={styles.input}
                onSubmitEditing={submit}
                returnKeyType="send"
              />
              <PressableScale haptic onPress={submit} style={styles.send} accessibilityLabel="Envoyer">
                {add.isPending ? <ActivityIndicator size="small" color={COLORS.text} /> : <Ionicons name="arrow-up" size={20} color={COLORS.text} />}
              </PressableScale>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.scrimSoft },
  kav: { width: '100%', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    maxHeight: 560,
    minHeight: 380,
    paddingHorizontal: SPACING.screen,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, marginTop: SPACING.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  loader: { paddingVertical: SPACING.xxl },
  list: { flexGrow: 0, maxHeight: 400 },
  comment: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  avatarText: { fontFamily: FONTS.bold, color: COLORS.primaryBright },
  flex: { flex: 1 },
  body: { fontSize: 14.5, lineHeight: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    color: COLORS.text,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
});
