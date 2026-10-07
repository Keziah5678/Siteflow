import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SPACING } from '@/constants/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface Props {
  title: string;
  back?: boolean;
  right?: ReactNode;
  large?: boolean;
}

export function ScreenHeader({ title, back = true, right, large = false }: Props) {
  return (
    <View style={styles.row}>
      {back ? (
        <IconButton
          icon="chevron-back"
          size={42}
          accessibilityLabel="Retour"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      ) : null}
      <AppText variant={large ? 'h1' : 'h3'} style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md },
  title: { flex: 1 },
  right: { flexDirection: 'row', gap: SPACING.sm },
});
