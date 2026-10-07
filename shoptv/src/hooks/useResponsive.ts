import { useWindowDimensions } from 'react-native';

import { LAYOUT, SPACING } from '@/constants/theme';

/** Largeur utile : mobile plein écran, contenu centré et borné sur tablette/web. */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(width, LAYOUT.maxContentWidth);
  return {
    width,
    height,
    contentWidth,
    isWide: width > LAYOUT.maxContentWidth + 80,
    gutter: SPACING.screen,
    innerWidth: contentWidth - SPACING.screen * 2,
  };
}
