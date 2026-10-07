import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, Props>(function TextField({ label, icon, error, style, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="caption" color={COLORS.textSecondary} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.field, focused && styles.focused, !!error && styles.errored]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? COLORS.primaryBright : COLORS.textSecondary} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={COLORS.textMuted}
          selectionColor={COLORS.primaryBright}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
      </View>
      {error ? (
        <AppText variant="small" color={COLORS.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: SPACING.xs + 2 },
  label: { marginLeft: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSecondary,
  },
  focused: { borderColor: COLORS.primaryBorder, backgroundColor: COLORS.surface },
  errored: { borderColor: COLORS.danger },
  input: { flex: 1, color: COLORS.text, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: SPACING.md, outlineStyle: 'none' } as object,
});
