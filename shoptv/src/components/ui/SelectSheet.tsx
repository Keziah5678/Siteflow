import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, LAYOUT, RADIUS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface Props<T extends string> {
  visible: boolean;
  title: string;
  options: SelectOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

/** Feuille de sélection (bottom sheet) en verre dépoli. */
export function SelectSheet<T extends string>({ visible, title, options, value, onSelect, onClose }: Props<T>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <Animated.View entering={SlideInDown.springify().damping(20)} style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={styles.handle} />
          <AppText variant="h3" style={styles.title}>
            {title}
          </AppText>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onSelect(o.value);
                  onClose();
                }}
                style={[styles.option, active && styles.optionActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                {o.icon ? <Ionicons name={o.icon} size={18} color={active ? COLORS.primaryBright : COLORS.textSecondary} /> : null}
                <AppText variant="bodyMedium" style={styles.optionLabel} color={active ? COLORS.text : COLORS.textSecondary}>
                  {o.label}
                </AppText>
                {active ? <Ionicons name="checkmark-circle" size={20} color={COLORS.primaryBright} /> : null}
              </Pressable>
            );
          })}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: COLORS.scrim },
  sheet: {
    width: '100%',
    maxWidth: LAYOUT.maxContentWidth,
    padding: SPACING.screen,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    gap: SPACING.xs,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, marginBottom: SPACING.md },
  title: { marginBottom: SPACING.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md },
  optionActive: { backgroundColor: COLORS.primarySoft },
  optionLabel: { flex: 1 },
});
