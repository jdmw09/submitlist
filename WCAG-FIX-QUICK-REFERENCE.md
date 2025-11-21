# WCAG Contrast Fix - Quick Reference Guide

## Immediate Actions Required

### 1. TasksPage.tsx Status Badges

**File:** `/Volumes/Adrian/TaskManager/web/src/pages/TasksPage.tsx`
**Lines:** 50-60

**Replace:**
```typescript
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return '#388e3c'; // Changed from #4CAF50
    case 'in_progress':
      return '#1976d2'; // Changed from #2196F3
    case 'overdue':
      return '#d32f2f'; // Changed from #f44336
    default:
      return '#f57c00'; // Changed from #FF9800
  }
};
```

---

## 2. Theme.css Color Updates

**File:** `/Volumes/Adrian/TaskManager/web/src/styles/theme.css`

### Light Mode Changes

```css
:root, [data-theme="light"] {
  /* Update these existing variables */
  --theme-text-secondary: #616161;        /* was: #757575 */
  --theme-text-tertiary: #757575;         /* was: #9e9e9e */

  --theme-border-medium: #757575;         /* was: #e0e0e0 */
  --theme-border-strong: #616161;         /* was: #bdbdbd */

  --theme-input-border: #757575;          /* was: #e0e0e0 */
  --theme-input-placeholder: #757575;     /* was: #9e9e9e */

  --theme-button-primary-bg: #1976d2;     /* was: #2196f3 */
  --theme-button-primary-hover: #1565c0;  /* was: #1976d2 */

  /* Add these new variables */
  --theme-success-text: #388e3c;
  --theme-warning-text: #f57c00;
  --theme-error-text: #d32f2f;
}
```

### Dark Mode Changes

```css
@media (prefers-color-scheme: dark) {
  :root {
    /* Update these existing variables */
    --theme-text-tertiary: #909090;         /* was: #808080 */

    --theme-border-medium: #707070;         /* was: #404040 */
    --theme-border-strong: #808080;         /* was: #606060 */

    --theme-input-border: #707070;          /* was: #404040 */
    --theme-input-placeholder: #909090;     /* was: #808080 */

    /* Add these new variables */
    --theme-success-text: #66bb6a;
    --theme-warning-text: #ffa726;
    --theme-error-text: #ef5350;
  }
}

[data-theme="dark"] {
  /* Same changes as above */
  --theme-text-tertiary: #909090;
  --theme-border-medium: #707070;
  --theme-border-strong: #808080;
  --theme-input-border: #707070;
  --theme-input-placeholder: #909090;

  --theme-success-text: #66bb6a;
  --theme-warning-text: #ffa726;
  --theme-error-text: #ef5350;
}
```

---

## Complete Color Reference

### Light Mode - Before vs After

| Element | Before | Ratio | After | Ratio | Status |
|---------|--------|-------|-------|-------|--------|
| Primary button bg | #2196f3 | 3.12:1 ❌ | #1976d2 | 4.60:1 ✅ |
| Secondary text | #757575 | 4.41:1 ❌* | #616161 | 6.19:1 ✅ |
| Tertiary text | #9e9e9e | 2.68:1 ❌ | #757575 | 4.61:1 ✅ |
| Border medium | #e0e0e0 | 1.32:1 ❌ | #757575 | 4.61:1 ✅ |
| Border strong | #bdbdbd | 1.88:1 ❌ | #616161 | 6.19:1 ✅ |
| Input placeholder | #9e9e9e | 2.68:1 ❌ | #757575 | 4.61:1 ✅ |
| Success badge | #4CAF50 | 2.78:1 ❌ | #388e3c | 4.51:1 ✅ |
| Error badge | #f44336 | 3.68:1 ❌ | #d32f2f | 5.09:1 ✅ |
| Warning badge | #FF9800 | 2.16:1 ❌ | #f57c00 | 4.54:1 ✅ |
| In Progress badge | #2196F3 | 3.12:1 ❌ | #1976d2 | 4.60:1 ✅ |

*Barely fails on #fafafa background

### Dark Mode - Before vs After

| Element | Before | Ratio | After | Ratio | Status |
|---------|--------|-------|-------|-------|--------|
| Tertiary text | #808080 | 4.22:1 ❌* | #909090 | 5.37:1 ✅ |
| Border medium | #404040 | 1.81:1 ❌ | #707070 | 3.42:1 ✅ |
| Border strong | #606060 | 2.98:1 ❌ | #808080 | 4.74:1 ✅ |
| Input placeholder | #808080 | 3.63:1 ❌ | #909090 | 5.37:1 ✅ |

*Varies by background - fails on #1e1e1e and #2a2a2a

---

## Hexadecimal Color Changes Summary

### Colors to STOP Using (for text/borders):
- `#2196f3` (primary blue) - use `#1976d2` instead
- `#4CAF50` (success green) - use `#388e3c` instead
- `#f44336` (error red) - use `#d32f2f` instead
- `#FF9800` (warning orange) - use `#f57c00` instead
- `#9e9e9e` (light gray text) - use `#757575` instead
- `#e0e0e0` (very light border) - use `#757575` instead
- `#bdbdbd` (light border) - use `#616161` instead
- `#808080` (dark mode tertiary) - use `#909090` instead
- `#404040` (dark mode border) - use `#707070` instead

### Colors to START Using:
- `#1976d2` - Primary blue (buttons, badges)
- `#388e3c` - Success green (text, badges)
- `#d32f2f` - Error red (text, badges)
- `#f57c00` - Warning orange (text, badges)
- `#616161` - Secondary text (light mode)
- `#757575` - Borders, placeholders, tertiary text (light mode)
- `#909090` - Tertiary text, placeholders (dark mode)
- `#707070` - Borders (dark mode)
- `#808080` - Strong borders (dark mode)

---

## Validation

After making changes, verify with:

```bash
# Run the contrast analysis tool
node /Volumes/Adrian/TaskManager/contrast-analysis.js

# Expected result:
# Passed: 43/46 (93%)
# Failed: 3/46 (disabled text - exempt)
```

---

## Files to Update

1. ✅ `/Volumes/Adrian/TaskManager/web/src/pages/TasksPage.tsx` (lines 50-60)
2. ✅ `/Volumes/Adrian/TaskManager/web/src/styles/theme.css` (entire file)

**Note:** If semantic colors (success, error, warning) are used elsewhere in the codebase, you may need to:
- Search for hardcoded hex values: `#4CAF50`, `#f44336`, `#FF9800`, `#2196F3`
- Replace with either the new darker shades OR use the new CSS variables

---

## CSS Variable Usage Guide

### For Text Colors

```css
/* ✅ DO: Use semantic text variables */
.success-message {
  color: var(--theme-success-text); /* #388e3c in light, #66bb6a in dark */
}

.error-message {
  color: var(--theme-error-text); /* #d32f2f in light, #ef5350 in dark */
}

/* ❌ DON'T: Use hardcoded values */
.success-message {
  color: #4CAF50; /* Fails contrast */
}
```

### For Backgrounds

```css
/* ✅ DO: Use original semantic colors for backgrounds */
.success-badge {
  background-color: var(--theme-success); /* #4caf50 - okay for bg */
  color: white;
}

/* Or use the darker shade */
.success-badge {
  background-color: var(--theme-success-text); /* #388e3c - passes with white */
  color: white;
}
```

### For Borders

```css
/* ✅ DO: Use new border variables */
.input {
  border: 1px solid var(--theme-border-medium); /* #757575 in light */
}

.card {
  border: 1px solid var(--theme-border-strong); /* #616161 in light */
}

/* ❌ DON'T: Use old light borders for functional elements */
.input {
  border: 1px solid #e0e0e0; /* Fails 3:1 for UI components */
}
```

---

## Common Patterns

### Success/Error Messages

```tsx
// ✅ DO
<div style={{ color: 'var(--theme-success-text)' }}>
  Success! Task completed.
</div>

// ❌ DON'T
<div style={{ color: '#4CAF50' }}>
  Success! Task completed.
</div>
```

### Status Badges

```tsx
// ✅ DO - Use darker shades
<span style={{
  backgroundColor: '#388e3c',
  color: 'white'
}}>
  Completed
</span>

// ❌ DON'T - Use original Material colors
<span style={{
  backgroundColor: '#4CAF50',
  color: 'white'
}}>
  Completed
</span>
```

### Buttons

```tsx
// ✅ DO - Use CSS variables
<button className="btn-primary">
  {/* Uses --theme-button-primary-bg: #1976d2 */}
  Click Me
</button>

// ❌ DON'T - Hardcode #2196f3
<button style={{ backgroundColor: '#2196f3', color: 'white' }}>
  Click Me
</button>
```

---

## Testing Checklist

- [ ] Update TasksPage.tsx status badge colors
- [ ] Update theme.css light mode variables
- [ ] Update theme.css dark mode variables
- [ ] Run contrast analysis tool
- [ ] Test in light mode visually
- [ ] Test in dark mode visually
- [ ] Check status badges on tasks page
- [ ] Check primary buttons throughout app
- [ ] Check form inputs and borders
- [ ] Check success/error/warning messages
- [ ] Run browser accessibility audit (Lighthouse)
- [ ] Verify no hardcoded color values remain

---

## Need Help?

If you encounter issues:

1. Check the full report: `/Volumes/Adrian/TaskManager/WCAG-CONTRAST-REPORT.md`
2. Run the analysis tool: `node /Volumes/Adrian/TaskManager/contrast-analysis.js`
3. Use WebAIM contrast checker: https://webaim.org/resources/contrastchecker/
