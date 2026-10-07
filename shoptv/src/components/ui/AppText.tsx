import { Text, type TextProps } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/constants/theme';

export type TextVariant = keyof typeof TYPOGRAPHY;

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** Texte typé par le design system : jamais de fontFamily/couleur en dur. */
export function AppText({ variant = 'body', color = COLORS.text, align, style, ...rest }: Props) {
  return <Text {...rest} style={[TYPOGRAPHY[variant], { color }, align && { textAlign: align }, style]} />;
}
