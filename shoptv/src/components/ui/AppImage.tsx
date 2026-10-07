import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { COLORS, GRADIENTS } from '@/constants/theme';

interface Props extends Omit<ImageProps, 'source'> {
  uri: string | null | undefined;
}

/**
 * Image optimisée (cache disque + mémoire, transition douce).
 * En cas d'échec de chargement, affiche un dégradé de marque.
 */
export function AppImage({ uri, style, contentFit = 'cover', transition = 220, ...rest }: Props) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[style as object, styles.fallback]}>
        <LinearGradient colors={GRADIENTS.hero} style={StyleSheet.absoluteFill} />
        <Ionicons name="sparkles-outline" size={28} color={COLORS.primaryBorder} />
      </View>
    );
  }
  return (
    <Image
      {...rest}
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
      recyclingKey={uri}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: COLORS.surface },
});
