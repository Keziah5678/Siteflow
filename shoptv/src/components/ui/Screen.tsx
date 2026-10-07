import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, LAYOUT } from '@/constants/theme';

interface Props {
  children: ReactNode;
  /** Applique le padding de la zone sûre en haut. */
  top?: boolean;
  /** Mise en page large (administration sur tablette / web). */
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Conteneur d'écran : fond profond + largeur bornée centrée (tablette / web). */
export function Screen({ children, top = true, wide = false, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.column, wide && styles.wide, top && { paddingTop: insets.top }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: LAYOUT.maxContentWidth },
  wide: { maxWidth: LAYOUT.maxAdminWidth },
});
