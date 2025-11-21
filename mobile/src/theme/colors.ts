/**
 * Theme Color Configuration for React Native
 * Provides light and dark mode color schemes
 */

export interface ColorScheme {
  // Background Colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgOverlay: string;

  // Text Colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textDisabled: string;

  // Border Colors
  borderLight: string;
  borderMedium: string;
  borderStrong: string;
  borderFocus: string;

  // Brand Colors
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;

  // Semantic Colors
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;

  // Component-specific Colors
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  inputPlaceholder: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
}

export const lightColors: ColorScheme = {
  // Background Colors
  bgPrimary: '#ffffff',
  bgSecondary: '#f5f5f5',
  bgTertiary: '#fafafa',
  bgElevated: '#ffffff',
  bgOverlay: 'rgba(0, 0, 0, 0.5)',

  // Text Colors
  textPrimary: '#212121',
  textSecondary: '#757575',
  textTertiary: '#9e9e9e',
  textInverse: '#ffffff',
  textDisabled: '#bdbdbd',

  // Border Colors
  borderLight: '#f0f0f0',
  borderMedium: '#e0e0e0',
  borderStrong: '#bdbdbd',
  borderFocus: '#2196f3',

  // Brand Colors
  primary: '#2196f3',
  primaryHover: '#1976d2',
  primaryLight: '#e3f2fd',
  primaryDark: '#0d47a1',

  // Semantic Colors
  success: '#4caf50',
  successBg: '#e8f5e9',
  warning: '#ff9800',
  warningBg: '#fff3e0',
  error: '#f44336',
  errorBg: '#ffebee',
  info: '#2196f3',
  infoBg: '#e3f2fd',

  // Component-specific Colors
  cardBg: '#ffffff',
  cardBorder: '#e0e0e0',
  inputBg: '#ffffff',
  inputBorder: '#e0e0e0',
  inputPlaceholder: '#9e9e9e',
  buttonPrimaryBg: '#2196f3',
  buttonPrimaryText: '#ffffff',
  buttonSecondaryBg: '#f5f5f5',
  buttonSecondaryText: '#212121',
};

export const darkColors: ColorScheme = {
  // Background Colors
  bgPrimary: '#121212',
  bgSecondary: '#1e1e1e',
  bgTertiary: '#2a2a2a',
  bgElevated: '#1e1e1e',
  bgOverlay: 'rgba(0, 0, 0, 0.7)',

  // Text Colors
  textPrimary: '#ffffff',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  textInverse: '#121212',
  textDisabled: '#606060',

  // Border Colors
  borderLight: '#2a2a2a',
  borderMedium: '#404040',
  borderStrong: '#606060',
  borderFocus: '#42a5f5',

  // Brand Colors
  primary: '#42a5f5',
  primaryHover: '#64b5f6',
  primaryLight: '#1e3a5f',
  primaryDark: '#90caf9',

  // Semantic Colors
  success: '#66bb6a',
  successBg: '#1b3a1c',
  warning: '#ffa726',
  warningBg: '#3d2e1a',
  error: '#ef5350',
  errorBg: '#3a1a1a',
  info: '#42a5f5',
  infoBg: '#1e3a5f',

  // Component-specific Colors
  cardBg: '#1e1e1e',
  cardBorder: '#404040',
  inputBg: '#2a2a2a',
  inputBorder: '#404040',
  inputPlaceholder: '#808080',
  buttonPrimaryBg: '#42a5f5',
  buttonPrimaryText: '#121212',
  buttonSecondaryBg: '#2a2a2a',
  buttonSecondaryText: '#ffffff',
};

export type ThemeMode = 'light' | 'dark' | 'system';
