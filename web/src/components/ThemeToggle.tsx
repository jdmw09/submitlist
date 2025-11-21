import React, { useState, useRef, useEffect } from 'react';
import { useTheme, ThemeMode } from '../hooks/useTheme';
import '../styles/ThemeToggle.css';

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
 * ThemeToggle component - Allows users to switch between light, dark, and system theme modes
 *
 * Features:
 * - Dropdown menu with three theme options
 * - Visual icons for each theme
 * - Persists user preference in localStorage
 * - Respects system preference when "System" is selected
 * - Keyboard accessible
 */
export const ThemeToggle: React.FC = () => {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  const currentOption = themeOptions.find(opt => opt.value === theme) || themeOptions[2];

  return (
    <div className="theme-toggle" ref={dropdownRef}>
      <button
        id="theme-button"
        className="theme-toggle-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Theme settings - choose light, dark, or system theme"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="theme-menu"
        title={`Current theme: ${currentOption.label}${theme === 'system' ? ` (${effectiveTheme})` : ''}`}
      >
        <span className="theme-toggle-icon">{currentOption.icon}</span>
        <span className="theme-toggle-label">{currentOption.label}</span>
        <svg
          className={`theme-toggle-chevron ${isOpen ? 'open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          id="theme-menu"
          className="theme-toggle-dropdown"
          role="menu"
          aria-labelledby="theme-button"
        >
          {themeOptions.map((option) => (
            <button
              key={option.value}
              className={`theme-toggle-option ${theme === option.value ? 'active' : ''}`}
              onClick={() => handleThemeChange(option.value)}
              role="menuitem"
              aria-label={`${option.label} theme${option.value === 'system' ? ' - follows system preference' : ''}`}
              aria-checked={theme === option.value}
              tabIndex={0}
            >
              <span className="theme-option-icon">{option.icon}</span>
              <span className="theme-option-label">{option.label}</span>
              {theme === option.value && (
                <svg
                  className="theme-option-check"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M13 4L6 11L3 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {option.value === 'system' && theme === 'system' && (
                <span className="theme-option-hint">({effectiveTheme})</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
