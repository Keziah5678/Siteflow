import { StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS } from '@/constants/theme';

import { AppText } from './AppText';

/** Logotype SHOPTV : « SHOP » blanc + « TV » néon. */
export function Logo({ size = 30, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <View>
      <Text style={[styles.logo, { fontSize: size }]} accessibilityRole="header" accessibilityLabel="SHOPTV">
        SHOP<Text style={styles.tv}>TV</Text>
      </Text>
      {tagline ? (
        <AppText variant="caption" color={COLORS.textSecondary} style={styles.tagline}>
          Le shopping devient un spectacle.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { fontFamily: FONTS.display, color: COLORS.text, letterSpacing: 0.5 },
  tv: {
    color: COLORS.primaryBright,
    textShadowColor: COLORS.fuchsia,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  tagline: { marginTop: 2, fontSize: 13.5 },
});
