/**
 * Spacing Constants - Mobile Design System
 * 8-point grid system for consistent spacing
 */

export const spacing = {
  // Base unit: 4px
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 12,   // 12px
  base: 16, // 16px (default)
  lg: 20,   // 20px
  xl: 24,   // 24px
  '2xl': 32,  // 32px
  '3xl': 40,  // 40px
  '4xl': 48,  // 48px
  '5xl': 64,  // 64px
  '6xl': 80,  // 80px
  '7xl': 96,  // 96px
} as const;

/**
 * Border Radius Values
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

/**
 * Component-specific spacing
 */
export const componentSpacing = {
  // Cards
  cardPadding: spacing.base,
  cardPaddingLarge: spacing.xl,
  cardMarginBottom: spacing.base,

  // Buttons
  buttonPaddingVertical: spacing.md,
  buttonPaddingHorizontal: spacing.base,
  buttonPaddingSmallVertical: spacing.sm,
  buttonPaddingSmallHorizontal: spacing.md,

  // Inputs
  inputPaddingVertical: spacing.md,
  inputPaddingHorizontal: spacing.md,
  inputMarginVertical: spacing.sm,

  // Lists
  listItemPaddingVertical: spacing.md,
  listItemPaddingHorizontal: spacing.base,
  listItemSpacing: spacing.sm,

  // Sections
  sectionMarginBottom: spacing.lg,
  sectionPadding: spacing.lg,

  // Container
  containerPadding: spacing.lg,
  containerPaddingSmall: spacing.base,
} as const;

/**
 * Touch Target Sizes (minimum 44px for accessibility)
 */
export const touchTargets = {
  minimum: 44,
  comfortable: 48,
  large: 56,
} as const;
