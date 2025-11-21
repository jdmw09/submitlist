/**
 * Mobile Theme System - Central Export
 * Import all theme constants from a single location
 *
 * @example
 * import { colors, spacing, typography } from '@/theme';
 * import { useTheme } from '@/contexts/ThemeContext';
 *
 * const MyComponent = () => {
 *   const { colors } = useTheme(); // For dynamic colors (theme-aware)
 *
 *   return (
 *     <View style={{ padding: spacing.base }}>
 *       <Text style={{ fontSize: typography.fontSize.lg }}>Hello</Text>
 *     </View>
 *   );
 * };
 */

// Export color schemes (for reference, use useTheme hook for dynamic colors)
export { lightColors, darkColors, type ColorScheme, type ThemeMode } from './colors';

// Export spacing constants
export { spacing, borderRadius, componentSpacing, touchTargets } from './spacing';

// Export typography constants
export { fontSize, fontWeight, lineHeight, letterSpacing, typography } from './typography';

// Re-export theme hook for convenience
export { useTheme, ThemeProvider } from '../contexts/ThemeContext';
