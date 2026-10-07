/**
 * SHOPTV — Design system.
 * Toutes les couleurs, typos, espacements, rayons, ombres et timings
 * de l'application sont définis ici. Ne jamais coder une couleur en dur
 * dans un composant : passer par ces constantes.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { Easing } from 'react-native-reanimated';

export const COLORS = {
  background: '#050509',
  backgroundSecondary: '#0B0B12',
  surface: '#11111B',
  surfaceElevated: '#171724',
  glass: 'rgba(22, 18, 38, 0.62)',
  glassStrong: 'rgba(28, 20, 48, 0.82)',
  overlay: 'rgba(5, 5, 9, 0.72)',

  primary: '#8B2CFF',
  primaryBright: '#B44CFF',
  fuchsia: '#E33CFF',
  primarySoft: 'rgba(139, 44, 255, 0.18)',
  primaryBorder: 'rgba(180, 76, 255, 0.55)',
  link: '#A970FF',
  glowText: 'rgba(180, 76, 255, 0.55)',

  text: '#FFFFFF',
  textSecondary: '#A8A8B3',
  textMuted: '#6E6E7A',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',

  success: '#3DDC97',
  warning: '#FFB547',
  danger: '#FF4D6D',
  star: '#FFC83D',
  // Voiles, halos et teintes d'état (dérivés de la palette)
  scrim: 'rgba(0, 0, 0, 0.6)',
  scrimSoft: 'rgba(0, 0, 0, 0.5)',
  veil: 'rgba(5, 5, 9, 0.45)',
  veilLight: 'rgba(5, 5, 9, 0.38)',
  transparentBg: 'rgba(5, 5, 9, 0)',
  transparentSurface: 'rgba(11, 11, 18, 0)',
  surfaceFade: 'rgba(11, 11, 18, 0.85)',
  highlight: 'rgba(255, 255, 255, 0.07)',
  highlightBorder: 'rgba(255, 255, 255, 0.18)',
  highlightStrong: 'rgba(255, 255, 255, 0.25)',
  track: 'rgba(255, 255, 255, 0.15)',
  trackStrong: 'rgba(255, 255, 255, 0.22)',
  primaryFaint: 'rgba(139, 44, 255, 0.06)',
  primaryGlow: 'rgba(139, 44, 255, 0.28)',
  primaryHaze: 'rgba(139, 44, 255, 0.35)',
  primaryHazeSoft: 'rgba(139, 44, 255, 0.25)',
  primaryTint: 'rgba(139, 44, 255, 0.18)',
  primaryClear: 'rgba(139, 44, 255, 0)',
  dangerSoft: 'rgba(255, 77, 109, 0.14)',
  dangerBorder: 'rgba(255, 77, 109, 0.5)',
  warningSoft: 'rgba(255, 181, 71, 0.08)',
  warningBorder: 'rgba(255, 181, 71, 0.28)',
  successSoft: 'rgba(61, 220, 151, 0.08)',
  successBorder: 'rgba(61, 220, 151, 0.3)',
  splashTop: '#1A0833',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

/** Dégradés réutilisables (expo-linear-gradient). */
export const GRADIENTS = {
  primary: [COLORS.primary, COLORS.fuchsia] as const,
  primaryButton: ['#7A22F0', '#A93BFF', '#D33CFF'] as const,
  card: ['rgba(139,44,255,0.20)', 'rgba(11,11,18,0.0)'] as const,
  cardBorder: ['rgba(227,60,255,0.85)', 'rgba(139,44,255,0.25)', 'rgba(139,44,255,0.7)'] as const,
  scrimBottom: ['rgba(5,5,9,0)', 'rgba(5,5,9,0.65)', 'rgba(5,5,9,0.96)'] as const,
  scrimTop: ['rgba(5,5,9,0.75)', 'rgba(5,5,9,0)'] as const,
  hero: ['#1B0B33', '#0B0B12'] as const,
  shimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'] as const,
};

export const FONTS = {
  display: 'Unbounded_800ExtraBold',
  displayBold: 'Unbounded_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const TYPOGRAPHY = {
  logo: { fontFamily: FONTS.display, fontSize: 30, letterSpacing: 0.5 },
  hero: { fontFamily: FONTS.display, fontSize: 26, letterSpacing: 0.4 },
  h1: { fontFamily: FONTS.bold, fontSize: 30, letterSpacing: -0.4 },
  h2: { fontFamily: FONTS.bold, fontSize: 22, letterSpacing: -0.2 },
  h3: { fontFamily: FONTS.semibold, fontSize: 18 },
  title: { fontFamily: FONTS.semibold, fontSize: 16 },
  body: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: FONTS.medium, fontSize: 15 },
  caption: { fontFamily: FONTS.regular, fontSize: 13 },
  small: { fontFamily: FONTS.medium, fontSize: 11 },
  price: { fontFamily: FONTS.extrabold, fontSize: 28, letterSpacing: -0.5 },
  button: { fontFamily: FONTS.semibold, fontSize: 16 },
} satisfies Record<string, TextStyle>;

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  screen: 20,
} as const;

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  pill: 999,
} as const;

const glow = (color: string, radius: number, opacity: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    web: { boxShadow: `0 0 ${radius * 1.6}px ${color}` } as ViewStyle,
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: opacity,
      shadowRadius: radius,
      elevation,
    },
  }) ?? {};

export const SHADOWS = {
  glow: glow(COLORS.primary, 18, 0.75, 12),
  glowSoft: glow(COLORS.primary, 12, 0.45, 6),
  glowFuchsia: glow(COLORS.fuchsia, 16, 0.6, 10),
  card: glow(COLORS.black, 20, 0.6, 8),
} as const;

export const ANIMATIONS = {
  duration: { fast: 150, normal: 250, slow: 420, verySlow: 900 },
  spring: { damping: 16, stiffness: 220, mass: 0.6 },
  springSoft: { damping: 20, stiffness: 140 },
  pressScale: 0.96,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
  stagger: 60,
} as const;

export const LAYOUT = {
  maxContentWidth: 560,
  maxAdminWidth: 1100,
  tabBarHeight: 64,
  heroCardRatio: 1.32,
} as const;
