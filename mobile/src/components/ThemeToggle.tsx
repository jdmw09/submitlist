import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeMode } from '../theme/colors';

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: string;
}

const themeOptions: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
];

/**
 * ThemeToggle component for React Native
 * Displays three theme options as cards with touch interaction
 */
export const ThemeToggle: React.FC = () => {
  const { theme, colors, setTheme } = useTheme();

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        Appearance
      </Text>
      <View style={styles.optionsContainer}>
        {themeOptions.map((option) => {
          const isActive = theme === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.option,
                {
                  backgroundColor: isActive ? colors.primaryLight : colors.cardBg,
                  borderColor: isActive ? colors.primary : colors.borderMedium,
                },
              ]}
              onPress={() => handleThemeChange(option.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.icon}>{option.icon}</Text>
              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: isActive ? colors.primary : colors.textPrimary,
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {option.label}
              </Text>
              {isActive && (
                <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 14,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ThemeToggle;
