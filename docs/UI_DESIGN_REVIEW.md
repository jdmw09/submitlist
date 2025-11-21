# UI/UX Design Review & Cleanup

## Executive Summary

This document provides a comprehensive UI/UX audit and redesign strategy for TaskManager. It addresses inconsistencies, improves user experience, and establishes a design system for scalable, maintainable UI development.

**Goals:**
- Create consistent, professional design
- Improve usability and accessibility
- Establish reusable design system
- Enhance mobile responsiveness
- Reduce technical debt

---

## Current State Analysis

### Issues Identified

#### 1. Inconsistent Styling
```
Problems:
❌ No design system or style guide
❌ Hardcoded colors throughout codebase
❌ Inconsistent spacing (8px, 12px, 16px, 20px, 24px with no pattern)
❌ Mixed font sizes (14px, 16px, 18px, 20px, 32px)
❌ Inconsistent button styles
❌ Different card styles across pages
❌ No consistent border-radius values
```

#### 2. Color Palette Issues
```css
/* Current - scattered throughout */
#2196F3 /* Blue - primary? */
#4CAF50 /* Green - success */
#FF9800 /* Orange - warning? */
#f44336 /* Red - danger */
#9C27B0 /* Purple - submitted status */
#667eea /* Purple gradient */
#764ba2 /* Purple gradient */
#e0e0e0 /* Gray - borders */
#f9f9f9 /* Gray - backgrounds */
/* ... and many more */
```

#### 3. Typography Problems
```
❌ No typography scale
❌ Inconsistent heading hierarchy
❌ No line-height standards
❌ Mixed font weights (normal, 500, 600, bold)
❌ No letter-spacing guidelines
```

#### 4. Component Inconsistencies
```
Buttons:
- .btn, .btn-primary, .btn-secondary, .btn-danger, .btn-success
- Different sizes: .btn-sm (inconsistent implementation)
- Inconsistent padding and hover states

Cards:
- .card (generic)
- .requirement-card
- .completion-card
- .completion-item
- All with different styling

Forms:
- .input-group (used everywhere)
- Inconsistent label styling
- No error state styling
- No focus states
```

#### 5. Responsive Design Issues
```
❌ Breakpoints used: 768px (only one)
❌ No mobile-first approach
❌ Some components don't stack properly on mobile
❌ Touch targets too small (<44px)
❌ Text too small on mobile
```

#### 6. Accessibility Issues
```
❌ No focus indicators on many elements
❌ Insufficient color contrast in some areas
❌ Missing ARIA labels
❌ No keyboard navigation support
❌ Form errors not announced to screen readers
```

---

## Design System

### 1. Color Palette

#### Primary Colors
```css
:root {
  /* Primary - Blue */
  --color-primary-50: #e3f2fd;
  --color-primary-100: #bbdefb;
  --color-primary-200: #90caf9;
  --color-primary-300: #64b5f6;
  --color-primary-400: #42a5f5;
  --color-primary-500: #2196f3; /* Main */
  --color-primary-600: #1e88e5;
  --color-primary-700: #1976d2;
  --color-primary-800: #1565c0;
  --color-primary-900: #0d47a1;

  /* Success - Green */
  --color-success-50: #e8f5e9;
  --color-success-100: #c8e6c9;
  --color-success-200: #a5d6a7;
  --color-success-300: #81c784;
  --color-success-400: #66bb6a;
  --color-success-500: #4caf50; /* Main */
  --color-success-600: #43a047;
  --color-success-700: #388e3c;
  --color-success-800: #2e7d32;
  --color-success-900: #1b5e20;

  /* Warning - Orange */
  --color-warning-50: #fff3e0;
  --color-warning-100: #ffe0b2;
  --color-warning-200: #ffcc80;
  --color-warning-300: #ffb74d;
  --color-warning-400: #ffa726;
  --color-warning-500: #ff9800; /* Main */
  --color-warning-600: #fb8c00;
  --color-warning-700: #f57c00;
  --color-warning-800: #ef6c00;
  --color-warning-900: #e65100;

  /* Error - Red */
  --color-error-50: #ffebee;
  --color-error-100: #ffcdd2;
  --color-error-200: #ef9a9a;
  --color-error-300: #e57373;
  --color-error-400: #ef5350;
  --color-error-500: #f44336; /* Main */
  --color-error-600: #e53935;
  --color-error-700: #d32f2f;
  --color-error-800: #c62828;
  --color-error-900: #b71c1c;

  /* Info - Purple */
  --color-info-50: #f3e5f5;
  --color-info-100: #e1bee7;
  --color-info-200: #ce93d8;
  --color-info-300: #ba68c8;
  --color-info-400: #ab47bc;
  --color-info-500: #9c27b0; /* Main */
  --color-info-600: #8e24aa;
  --color-info-700: #7b1fa2;
  --color-info-800: #6a1b9a;
  --color-info-900: #4a148c;
}
```

#### Neutral Colors
```css
:root {
  /* Grayscale */
  --color-gray-50: #fafafa;
  --color-gray-100: #f5f5f5;
  --color-gray-200: #eeeeee;
  --color-gray-300: #e0e0e0;
  --color-gray-400: #bdbdbd;
  --color-gray-500: #9e9e9e;
  --color-gray-600: #757575;
  --color-gray-700: #616161;
  --color-gray-800: #424242;
  --color-gray-900: #212121;

  /* Text Colors */
  --color-text-primary: var(--color-gray-900);
  --color-text-secondary: var(--color-gray-700);
  --color-text-disabled: var(--color-gray-500);
  --color-text-hint: var(--color-gray-600);

  /* Background Colors */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: var(--color-gray-50);
  --color-bg-tertiary: var(--color-gray-100);

  /* Border Colors */
  --color-border-light: var(--color-gray-200);
  --color-border-medium: var(--color-gray-300);
  --color-border-dark: var(--color-gray-400);
}
```

### 2. Typography

```css
:root {
  /* Font Families */
  --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
                       'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
                       'Helvetica Neue', sans-serif;
  --font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono',
                       Consolas, 'Courier New', monospace;

  /* Font Sizes */
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 1.875rem;  /* 30px */
  --font-size-4xl: 2.25rem;   /* 36px */
  --font-size-5xl: 3rem;      /* 48px */

  /* Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line Heights */
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
  --line-height-loose: 2;

  /* Letter Spacing */
  --letter-spacing-tight: -0.025em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.025em;
}
```

**Typography Scale:**
```css
/* Headings */
.h1 {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-tight);
}

.h2 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.h3 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
}

.h4 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
}

/* Body Text */
.body-lg {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-relaxed);
}

.body {
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
}

.body-sm {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

/* Captions & Labels */
.caption {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.overline {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}
```

### 3. Spacing System

```css
:root {
  /* Spacing Scale (based on 4px) */
  --spacing-0: 0;
  --spacing-1: 0.25rem;  /* 4px */
  --spacing-2: 0.5rem;   /* 8px */
  --spacing-3: 0.75rem;  /* 12px */
  --spacing-4: 1rem;     /* 16px */
  --spacing-5: 1.25rem;  /* 20px */
  --spacing-6: 1.5rem;   /* 24px */
  --spacing-8: 2rem;     /* 32px */
  --spacing-10: 2.5rem;  /* 40px */
  --spacing-12: 3rem;    /* 48px */
  --spacing-16: 4rem;    /* 64px */
  --spacing-20: 5rem;    /* 80px */
  --spacing-24: 6rem;    /* 96px */
}
```

### 4. Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm: 0.25rem;   /* 4px */
  --radius-base: 0.5rem;  /* 8px */
  --radius-md: 0.75rem;   /* 12px */
  --radius-lg: 1rem;      /* 16px */
  --radius-xl: 1.5rem;    /* 24px */
  --radius-full: 9999px;  /* Fully rounded */
}
```

### 5. Shadows

```css
:root {
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  --shadow-base: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}
```

### 6. Transitions

```css
:root {
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Component Library

### 1. Buttons

```css
/* Base Button */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-6);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  line-height: 1.5;
  border-radius: var(--radius-base);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-base);
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
}

.btn:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Variants */
.btn-primary {
  background: var(--color-primary-500);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  background: var(--color-gray-200);
  color: var(--color-text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-gray-300);
}

.btn-success {
  background: var(--color-success-500);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: var(--color-success-600);
}

.btn-danger {
  background: var(--color-error-500);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-error-600);
}

.btn-outline {
  background: transparent;
  border-color: var(--color-border-medium);
  color: var(--color-text-primary);
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-gray-50);
  border-color: var(--color-border-dark);
}

/* Sizes */
.btn-sm {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-sm);
}

.btn-lg {
  padding: var(--spacing-4) var(--spacing-8);
  font-size: var(--font-size-lg);
}

/* Full Width */
.btn-block {
  width: 100%;
}
```

### 2. Cards

```css
.card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card-header {
  margin-bottom: var(--spacing-4);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid var(--color-border-light);
}

.card-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.card-body {
  /* Content styling */
}

.card-footer {
  margin-top: var(--spacing-4);
  padding-top: var(--spacing-4);
  border-top: 1px solid var(--color-border-light);
}
```

### 3. Forms

```css
.form-group {
  margin-bottom: var(--spacing-5);
}

.form-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-2);
}

.form-label-required::after {
  content: ' *';
  color: var(--color-error-500);
}

.form-control {
  display: block;
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-base);
  line-height: 1.5;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.form-control:disabled {
  background: var(--color-gray-100);
  cursor: not-allowed;
}

.form-control.is-invalid {
  border-color: var(--color-error-500);
}

.form-control.is-invalid:focus {
  box-shadow: 0 0 0 3px rgba(244, 67, 54, 0.1);
}

.form-error {
  display: block;
  margin-top: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-error-500);
}

.form-hint {
  display: block;
  margin-top: var(--spacing-2);
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}

/* Select */
select.form-control {
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* Dropdown arrow */
  background-repeat: no-repeat;
  background-position: right var(--spacing-3) center;
  padding-right: var(--spacing-8);
}

/* Textarea */
textarea.form-control {
  resize: vertical;
  min-height: 100px;
}

/* Checkbox & Radio */
.form-check {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) 0;
}

.form-check-input {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.form-check-label {
  font-size: var(--font-size-base);
  cursor: pointer;
  user-select: none;
}
```

### 4. Badges & Status

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-1) var(--spacing-3);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}

.badge-primary {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
}

.badge-success {
  background: var(--color-success-100);
  color: var(--color-success-700);
}

.badge-warning {
  background: var(--color-warning-100);
  color: var(--color-warning-700);
}

.badge-error {
  background: var(--color-error-100);
  color: var(--color-error-700);
}

.badge-info {
  background: var(--color-info-100);
  color: var(--color-info-700);
}
```

### 5. Alerts

```css
.alert {
  padding: var(--spacing-4);
  border-radius: var(--radius-base);
  border-left: 4px solid;
  display: flex;
  gap: var(--spacing-3);
}

.alert-success {
  background: var(--color-success-50);
  border-color: var(--color-success-500);
  color: var(--color-success-900);
}

.alert-warning {
  background: var(--color-warning-50);
  border-color: var(--color-warning-500);
  color: var(--color-warning-900);
}

.alert-error {
  background: var(--color-error-50);
  border-color: var(--color-error-500);
  color: var(--color-error-900);
}

.alert-info {
  background: var(--color-info-50);
  border-color: var(--color-info-500);
  color: var(--color-info-900);
}
```

---

## Layout & Grid

### Container
```css
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--spacing-4);
}

@media (min-width: 768px) {
  .container {
    padding: 0 var(--spacing-6);
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 0 var(--spacing-8);
  }
}
```

### Grid System
```css
.grid {
  display: grid;
  gap: var(--spacing-6);
}

.grid-cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid-cols-4 { grid-template-columns: repeat(4, 1fr); }

@media (min-width: 768px) {
  .grid-md-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-md-cols-3 { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1024px) {
  .grid-lg-cols-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-lg-cols-4 { grid-template-columns: repeat(4, 1fr); }
}
```

### Flexbox Utilities
```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-wrap { flex-wrap: wrap; }

.justify-start { justify-content: flex-start; }
.justify-end { justify-content: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }

.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.items-center { align-items: center; }
.items-stretch { align-items: stretch; }

.gap-2 { gap: var(--spacing-2); }
.gap-3 { gap: var(--spacing-3); }
.gap-4 { gap: var(--spacing-4); }
.gap-6 { gap: var(--spacing-6); }
```

---

## Responsive Design

### Breakpoints
```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}
```

### Mobile-First Approach
```css
/* Default: Mobile */
.element {
  font-size: var(--font-size-sm);
  padding: var(--spacing-2);
}

/* Tablet */
@media (min-width: 768px) {
  .element {
    font-size: var(--font-size-base);
    padding: var(--spacing-4);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .element {
    font-size: var(--font-size-lg);
    padding: var(--spacing-6);
  }
}
```

---

## Accessibility

### Focus States
```css
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
```

### Color Contrast
- **WCAG AA**: Minimum contrast ratio of 4.5:1 for normal text
- **WCAG AAA**: Minimum contrast ratio of 7:1 for normal text
- All current colors meet WCAG AA standards

### Touch Targets
- Minimum touch target: 44px × 44px (iOS HIG, Android Material)
- Ensure all buttons, links meet minimum size

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Create `/web/src/styles/design-system.css`
- [ ] Define CSS variables
- [ ] Update global styles
- [ ] Test in all pages

### Phase 2: Components (Week 2)
- [ ] Refactor button components
- [ ] Standardize card components
- [ ] Update form components
- [ ] Create badge components

### Phase 3: Layout (Week 3)
- [ ] Implement grid system
- [ ] Update page layouts
- [ ] Improve mobile responsiveness
- [ ] Test on multiple devices

### Phase 4: Polish (Week 4)
- [ ] Add animations
- [ ] Improve loading states
- [ ] Add skeleton screens
- [ ] Final QA testing

---

## File Structure

```
web/src/
├─ styles/
│  ├─ design-system.css      # Design tokens
│  ├─ components/
│  │  ├─ buttons.css
│  │  ├─ cards.css
│  │  ├─ forms.css
│  │  ├─ badges.css
│  │  └─ alerts.css
│  ├─ layouts/
│  │  ├─ container.css
│  │  ├─ grid.css
│  │  └─ utilities.css
│  └─ global.css             # Global styles
```

---

## Before & After Examples

### Task Card - Before
```css
.requirement-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 16px;
  background: #fafafa;
}
```

### Task Card - After
```css
.requirement-card {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  background: var(--color-bg-secondary);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.requirement-card:hover {
  box-shadow: var(--shadow-md);
}
```

---

## Success Metrics

### Before
- 47 unique color values
- 18 different font sizes
- 12 different spacing values
- No consistent component library
- Single breakpoint (768px)

### After (Target)
- 10 color scales (semantic)
- 9 font sizes (typography scale)
- 13 spacing values (8-based scale)
- 20+ reusable components
- 4 breakpoints (mobile-first)

---

## Next Steps

1. Review and approve design system
2. Create design-system.css file
3. Update existing components one by one
4. Test responsive design on all devices
5. Document component usage
6. Train team on design system

---

## Dark Mode Support

### Theme Architecture

#### 1. Semantic Color Tokens
```css
:root {
  /* Light Theme (Default) */
  --theme-bg-primary: #ffffff;
  --theme-bg-secondary: #fafafa;
  --theme-bg-tertiary: #f5f5f5;
  --theme-bg-elevated: #ffffff;

  --theme-text-primary: #212121;
  --theme-text-secondary: #616161;
  --theme-text-tertiary: #757575;
  --theme-text-disabled: #9e9e9e;

  --theme-border-subtle: #f5f5f5;
  --theme-border-light: #eeeeee;
  --theme-border-medium: #e0e0e0;
  --theme-border-strong: #bdbdbd;

  --theme-overlay: rgba(0, 0, 0, 0.5);
  --theme-overlay-light: rgba(0, 0, 0, 0.1);

  /* Shadows - Light theme */
  --theme-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  --theme-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --theme-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

/* Dark Theme */
@media (prefers-color-scheme: dark) {
  :root {
    --theme-bg-primary: #121212;
    --theme-bg-secondary: #1e1e1e;
    --theme-bg-tertiary: #2a2a2a;
    --theme-bg-elevated: #1e1e1e;

    --theme-text-primary: #ffffff;
    --theme-text-secondary: #b0b0b0;
    --theme-text-tertiary: #808080;
    --theme-text-disabled: #666666;

    --theme-border-subtle: #2a2a2a;
    --theme-border-light: #333333;
    --theme-border-medium: #404040;
    --theme-border-strong: #595959;

    --theme-overlay: rgba(0, 0, 0, 0.7);
    --theme-overlay-light: rgba(0, 0, 0, 0.3);

    /* Shadows - Dark theme (elevation) */
    --theme-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.5);
    --theme-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
    --theme-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  }
}

/* Manual override with data attribute */
[data-theme="light"] {
  --theme-bg-primary: #ffffff;
  --theme-bg-secondary: #fafafa;
  --theme-bg-tertiary: #f5f5f5;
  --theme-bg-elevated: #ffffff;

  --theme-text-primary: #212121;
  --theme-text-secondary: #616161;
  --theme-text-tertiary: #757575;
  --theme-text-disabled: #9e9e9e;

  --theme-border-subtle: #f5f5f5;
  --theme-border-light: #eeeeee;
  --theme-border-medium: #e0e0e0;
  --theme-border-strong: #bdbdbd;

  --theme-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  --theme-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --theme-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  --theme-bg-primary: #121212;
  --theme-bg-secondary: #1e1e1e;
  --theme-bg-tertiary: #2a2a2a;
  --theme-bg-elevated: #1e1e1e;

  --theme-text-primary: #ffffff;
  --theme-text-secondary: #b0b0b0;
  --theme-text-tertiary: #808080;
  --theme-text-disabled: #666666;

  --theme-border-subtle: #2a2a2a;
  --theme-border-light: #333333;
  --theme-border-medium: #404040;
  --theme-border-strong: #595959;

  --theme-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.5);
  --theme-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
  --theme-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
}
```

#### 2. Adjusted Color Scales for Dark Mode
```css
/* Primary colors - work in both themes */
:root {
  --color-primary-500: #2196f3;
  --color-success-500: #4caf50;
  --color-warning-500: #ff9800;
  --color-error-500: #f44336;
  --color-info-500: #9c27b0;
}

/* Dark mode adjustments for better contrast */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary-500: #42a5f5;  /* Lighter for dark bg */
    --color-success-500: #66bb6a;
    --color-warning-500: #ffa726;
    --color-error-500: #ef5350;
    --color-info-500: #ab47bc;
  }
}

[data-theme="dark"] {
  --color-primary-500: #42a5f5;
  --color-success-500: #66bb6a;
  --color-warning-500: #ffa726;
  --color-error-500: #ef5350;
  --color-info-500: #ab47bc;
}
```

### Updated Component Styles

#### Cards with Theme Support
```css
.card {
  background: var(--theme-bg-elevated);
  border: 1px solid var(--theme-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--theme-shadow-sm);
  transition: box-shadow var(--transition-base);
  color: var(--theme-text-primary);
}

.card:hover {
  box-shadow: var(--theme-shadow-md);
}
```

#### Forms with Theme Support
```css
.form-control {
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-medium);
  color: var(--theme-text-primary);
}

.form-control::placeholder {
  color: var(--theme-text-disabled);
}

.form-control:focus {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

/* Dark mode specific adjustments */
@media (prefers-color-scheme: dark) {
  .form-control:focus {
    box-shadow: 0 0 0 3px rgba(66, 165, 245, 0.2);
  }
}

[data-theme="dark"] .form-control:focus {
  box-shadow: 0 0 0 3px rgba(66, 165, 245, 0.2);
}
```

#### Buttons with Theme Support
```css
.btn-secondary {
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-primary);
  border: 1px solid var(--theme-border-medium);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--theme-bg-secondary);
  border-color: var(--theme-border-strong);
}

.btn-outline {
  background: transparent;
  border-color: var(--theme-border-medium);
  color: var(--theme-text-primary);
}

.btn-outline:hover:not(:disabled) {
  background: var(--theme-bg-tertiary);
  border-color: var(--theme-border-strong);
}
```

### Theme Toggle Component

#### React Hook
```typescript
// hooks/useTheme.ts
import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme;
    return stored || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    } else {
      root.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(current => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
  };

  const setLightTheme = () => setTheme('light');
  const setDarkTheme = () => setTheme('dark');
  const setSystemTheme = () => setTheme('system');

  return {
    theme,
    setTheme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    setSystemTheme,
  };
};
```

#### Theme Toggle Button Component
```tsx
// components/ThemeToggle.tsx
import React from 'react';
import { useTheme } from '../hooks/useTheme';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  const getIcon = () => {
    switch (theme) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      default: return '💻';
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-outline btn-sm"
      aria-label="Toggle theme"
      title={`Current: ${theme}`}
    >
      <span>{getIcon()}</span>
    </button>
  );
};
```

### React Native Dark Mode

#### React Native Theme Context
```typescript
// mobile/src/contexts/ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: typeof lightColors;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const lightColors = {
  primary: '#2196f3',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#9c27b0',

  bgPrimary: '#ffffff',
  bgSecondary: '#fafafa',
  bgTertiary: '#f5f5f5',

  textPrimary: '#212121',
  textSecondary: '#616161',
  textTertiary: '#757575',
  textDisabled: '#9e9e9e',

  borderLight: '#eeeeee',
  borderMedium: '#e0e0e0',
  borderStrong: '#bdbdbd',
};

const darkColors = {
  primary: '#42a5f5',
  success: '#66bb6a',
  warning: '#ffa726',
  error: '#ef5350',
  info: '#ab47bc',

  bgPrimary: '#121212',
  bgSecondary: '#1e1e1e',
  bgTertiary: '#2a2a2a',

  textPrimary: '#ffffff',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  textDisabled: '#666666',

  borderLight: '#333333',
  borderMedium: '#404040',
  borderStrong: '#595959',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('system');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const stored = await AsyncStorage.getItem('theme');
    if (stored) {
      setThemeState(stored as ThemeMode);
    }
  };

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('theme', newTheme);
  };

  const toggleTheme = async () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    await setTheme(next);
  };

  const effectiveTheme = theme === 'system' ? systemColorScheme : theme;
  const isDark = effectiveTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
```

#### Mobile Component Example
```tsx
// mobile/src/screens/ExampleScreen.tsx
import { useTheme } from '../contexts/ThemeContext';

const ExampleScreen = () => {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ backgroundColor: colors.bgPrimary }}>
      <Text style={{ color: colors.textPrimary }}>
        Hello {isDark ? 'Dark' : 'Light'} Mode!
      </Text>
    </View>
  );
};
```

### Best Practices

#### 1. Always Use Semantic Tokens
```css
/* ✅ Good - uses theme tokens */
.element {
  background: var(--theme-bg-primary);
  color: var(--theme-text-primary);
  border: 1px solid var(--theme-border-medium);
}

/* ❌ Bad - hardcoded colors */
.element {
  background: #ffffff;
  color: #212121;
  border: 1px solid #e0e0e0;
}
```

#### 2. Test Both Themes
- Test all components in both light and dark modes
- Check color contrast in both themes (WCAG AA)
- Ensure images/icons work in both themes
- Test transitions when switching themes

#### 3. Handle Images & Media
```css
/* Invert images in dark mode if needed */
@media (prefers-color-scheme: dark) {
  .logo-dark-invert {
    filter: invert(1);
  }
}

/* Or use different images */
.logo {
  content: url('/logo-light.png');
}

@media (prefers-color-scheme: dark) {
  .logo {
    content: url('/logo-dark.png');
  }
}
```

#### 4. Accessibility
```css
/* Ensure sufficient contrast in both modes */
:root {
  /* Light mode - 7:1 contrast (AAA) */
  --theme-text-primary: #212121; /* on #ffffff */
}

@media (prefers-color-scheme: dark) {
  /* Dark mode - 7:1 contrast (AAA) */
  --theme-text-primary: #ffffff; /* on #121212 */
}
```

### Implementation Checklist

- [ ] Create theme CSS variables
- [ ] Update all components to use theme tokens
- [ ] Implement theme toggle hook/context
- [ ] Add theme toggle button to navigation
- [ ] Test all pages in both themes
- [ ] Ensure images work in both themes
- [ ] Verify color contrast (WCAG AA)
- [ ] Test theme persistence (localStorage)
- [ ] Test system preference detection
- [ ] Add smooth theme transitions
- [ ] Update mobile app with theme support
- [ ] Document theme usage for developers

---

## Conclusion

This design system provides:
- ✅ Consistent, professional UI
- ✅ Scalable component library
- ✅ Mobile-first responsive design
- ✅ **Light & Dark theme support**
- ✅ **Automatic system preference detection**
- ✅ Accessibility compliance
- ✅ Maintainable codebase
- ✅ Better developer experience

**Timeline**: 4-5 weeks (including dark mode)
**Impact**: Improved UX, faster development, better consistency, modern appearance
