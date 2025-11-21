/**
 * WCAG Contrast Ratio Analysis Tool
 * Calculates contrast ratios for Task Manager color combinations
 */

// Convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Calculate relative luminance
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio
function getContrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG compliance check
function checkWCAG(ratio, level = 'AA', size = 'normal') {
  if (level === 'AA') {
    if (size === 'large') {
      return { pass: ratio >= 3, required: 3 };
    }
    return { pass: ratio >= 4.5, required: 4.5 };
  }
  if (level === 'AAA') {
    if (size === 'large') {
      return { pass: ratio >= 4.5, required: 4.5 };
    }
    return { pass: ratio >= 7, required: 7 };
  }
}

// Test combinations
const tests = {
  lightMode: [
    // Primary text combinations
    { fg: '#1a1a1a', bg: '#ffffff', label: 'Primary text (#1a1a1a) on white', size: 'normal' },
    { fg: '#212121', bg: '#ffffff', label: 'Primary text (#212121) on white', size: 'normal' },
    { fg: '#212121', bg: '#fafafa', label: 'Primary text (#212121) on #fafafa', size: 'normal' },
    { fg: '#212121', bg: '#f5f5f5', label: 'Primary text (#212121) on #f5f5f5', size: 'normal' },

    // Secondary text combinations
    { fg: '#616161', bg: '#ffffff', label: 'Secondary text (#616161) on white', size: 'normal' },
    { fg: '#757575', bg: '#ffffff', label: 'Secondary text (#757575) on white', size: 'normal' },
    { fg: '#757575', bg: '#fafafa', label: 'Secondary text (#757575) on #fafafa', size: 'normal' },

    // Tertiary text combinations
    { fg: '#9e9e9e', bg: '#ffffff', label: 'Tertiary text (#9e9e9e) on white', size: 'normal' },
    { fg: '#9e9e9e', bg: '#fafafa', label: 'Tertiary text (#9e9e9e) on #fafafa', size: 'normal' },

    // Disabled text
    { fg: '#bdbdbd', bg: '#ffffff', label: 'Disabled text (#bdbdbd) on white', size: 'normal' },

    // Primary buttons
    { fg: '#ffffff', bg: '#2196F3', label: 'Primary button (white on #2196F3)', size: 'normal' },
    { fg: '#ffffff', bg: '#1976d2', label: 'Primary button hover (white on #1976d2)', size: 'normal' },

    // Semantic colors
    { fg: '#4CAF50', bg: '#ffffff', label: 'Success text (#4CAF50) on white', size: 'normal' },
    { fg: '#f44336', bg: '#ffffff', label: 'Error text (#f44336) on white', size: 'normal' },
    { fg: '#FF9800', bg: '#ffffff', label: 'Warning text (#FF9800) on white', size: 'normal' },

    // Status badges (with white text)
    { fg: '#ffffff', bg: '#4CAF50', label: 'Status badge: white on #4CAF50 (completed)', size: 'normal' },
    { fg: '#ffffff', bg: '#2196F3', label: 'Status badge: white on #2196F3 (in progress)', size: 'normal' },
    { fg: '#ffffff', bg: '#f44336', label: 'Status badge: white on #f44336 (overdue)', size: 'normal' },
    { fg: '#ffffff', bg: '#FF9800', label: 'Status badge: white on #FF9800 (pending)', size: 'normal' },

    // Border contrasts (for UI components - 3:1 ratio)
    { fg: '#e0e0e0', bg: '#ffffff', label: 'Border (#e0e0e0) on white', size: 'large', component: true },
    { fg: '#bdbdbd', bg: '#ffffff', label: 'Border strong (#bdbdbd) on white', size: 'large', component: true },

    // Input placeholders
    { fg: '#9e9e9e', bg: '#ffffff', label: 'Input placeholder (#9e9e9e) on white', size: 'normal' },
  ],

  darkMode: [
    // Primary text combinations
    { fg: '#ffffff', bg: '#121212', label: 'Primary text (#ffffff) on #121212', size: 'normal' },
    { fg: '#ffffff', bg: '#1e1e1e', label: 'Primary text (#ffffff) on #1e1e1e', size: 'normal' },
    { fg: '#ffffff', bg: '#2a2a2a', label: 'Primary text (#ffffff) on #2a2a2a', size: 'normal' },
    { fg: '#ffffff', bg: '#212121', label: 'Primary text (#ffffff) on #212121', size: 'normal' },

    // Secondary text combinations
    { fg: '#b0b0b0', bg: '#121212', label: 'Secondary text (#b0b0b0) on #121212', size: 'normal' },
    { fg: '#b0b0b0', bg: '#1e1e1e', label: 'Secondary text (#b0b0b0) on #1e1e1e', size: 'normal' },

    // Tertiary text combinations
    { fg: '#808080', bg: '#121212', label: 'Tertiary text (#808080) on #121212', size: 'normal' },
    { fg: '#808080', bg: '#1e1e1e', label: 'Tertiary text (#808080) on #1e1e1e', size: 'normal' },
    { fg: '#808080', bg: '#2a2a2a', label: 'Tertiary text (#808080) on #2a2a2a', size: 'normal' },

    // Disabled text
    { fg: '#606060', bg: '#121212', label: 'Disabled text (#606060) on #121212', size: 'normal' },
    { fg: '#606060', bg: '#1e1e1e', label: 'Disabled text (#606060) on #1e1e1e', size: 'normal' },

    // Primary buttons
    { fg: '#121212', bg: '#42a5f5', label: 'Primary button (#121212 on #42a5f5)', size: 'normal' },
    { fg: '#121212', bg: '#64b5f6', label: 'Primary button hover (#121212 on #64b5f6)', size: 'normal' },

    // Semantic colors (adjusted for dark mode)
    { fg: '#66bb6a', bg: '#121212', label: 'Success text (#66bb6a) on #121212', size: 'normal' },
    { fg: '#ef5350', bg: '#121212', label: 'Error text (#ef5350) on #121212', size: 'normal' },
    { fg: '#ffa726', bg: '#121212', label: 'Warning text (#ffa726) on #121212', size: 'normal' },

    // Status badges (hardcoded colors that don't change in dark mode)
    { fg: '#ffffff', bg: '#4CAF50', label: 'Status badge: white on #4CAF50 (completed) - SAME AS LIGHT', size: 'normal' },
    { fg: '#ffffff', bg: '#2196F3', label: 'Status badge: white on #2196F3 (in progress) - SAME AS LIGHT', size: 'normal' },
    { fg: '#ffffff', bg: '#f44336', label: 'Status badge: white on #f44336 (overdue) - SAME AS LIGHT', size: 'normal' },
    { fg: '#ffffff', bg: '#FF9800', label: 'Status badge: white on #FF9800 (pending) - SAME AS LIGHT', size: 'normal' },

    // Border contrasts
    { fg: '#404040', bg: '#121212', label: 'Border (#404040) on #121212', size: 'large', component: true },
    { fg: '#606060', bg: '#121212', label: 'Border strong (#606060) on #121212', size: 'large', component: true },
    { fg: '#2a2a2a', bg: '#121212', label: 'Border light (#2a2a2a) on #121212', size: 'large', component: true },

    // Input placeholders
    { fg: '#808080', bg: '#2a2a2a', label: 'Input placeholder (#808080) on #2a2a2a', size: 'normal' },
  ]
};

// Generate report
console.log('='.repeat(80));
console.log('WCAG AA CONTRAST RATIO ANALYSIS - TASK MANAGER WEB APP');
console.log('='.repeat(80));
console.log('');

let failures = [];
let warnings = [];
let passCount = 0;

for (const [mode, combinations] of Object.entries(tests)) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${mode.toUpperCase()} COMBINATIONS`);
  console.log('='.repeat(80));

  combinations.forEach(test => {
    const ratio = getContrastRatio(test.fg, test.bg);
    const isComponent = test.component || false;
    const requiredRatio = isComponent ? 3 : (test.size === 'large' ? 3 : 4.5);
    const isPassing = ratio >= requiredRatio;
    const status = isPassing ? '✓ PASS' : '✗ FAIL';
    const statusColor = isPassing ? '' : ' *** ATTENTION ***';

    console.log('');
    console.log(`${status}${statusColor}`);
    console.log(`  ${test.label}`);
    console.log(`  Foreground: ${test.fg} | Background: ${test.bg}`);
    console.log(`  Contrast Ratio: ${ratio.toFixed(2)}:1 (Required: ${requiredRatio}:1 for ${isComponent ? 'UI components' : test.size + ' text'})`);

    if (!isPassing) {
      const recommendation = generateRecommendation(test, ratio, requiredRatio);
      console.log(`  RECOMMENDATION: ${recommendation}`);
      failures.push({
        mode,
        ...test,
        ratio: ratio.toFixed(2),
        required: requiredRatio,
        recommendation
      });
    } else if (ratio < requiredRatio + 0.5) {
      warnings.push({
        mode,
        ...test,
        ratio: ratio.toFixed(2),
        message: 'Passes but very close to minimum - consider increasing contrast'
      });
    } else {
      passCount++;
    }
  });
}

console.log('\n\n');
console.log('='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total combinations tested: ${Object.values(tests).flat().length}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failures.length}`);
console.log(`Warnings: ${warnings.length}`);

if (failures.length > 0) {
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('FAILURES REQUIRING IMMEDIATE ATTENTION');
  console.log('='.repeat(80));

  failures.forEach((failure, i) => {
    console.log(`\n${i + 1}. ${failure.label} (${failure.mode})`);
    console.log(`   Current: ${failure.fg} on ${failure.bg}`);
    console.log(`   Ratio: ${failure.ratio}:1 (needs ${failure.required}:1)`);
    console.log(`   Fix: ${failure.recommendation}`);
  });
}

if (warnings.length > 0) {
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('WARNINGS - CLOSE TO MINIMUM');
  console.log('='.repeat(80));

  warnings.forEach((warning, i) => {
    console.log(`\n${i + 1}. ${warning.label} (${warning.mode})`);
    console.log(`   ${warning.fg} on ${warning.bg}`);
    console.log(`   Ratio: ${warning.ratio}:1`);
    console.log(`   ${warning.message}`);
  });
}

console.log('\n\n');
console.log('='.repeat(80));
console.log('RECOMMENDATIONS');
console.log('='.repeat(80));

if (failures.length === 0) {
  console.log('\n✓ ALL COLOR COMBINATIONS PASS WCAG AA STANDARDS!');
  console.log('\nYour Task Manager app has excellent color contrast compliance.');
} else {
  console.log('\nSee failures list above for specific color adjustments needed.');
}

console.log('\n');

// Helper function to generate recommendations
function generateRecommendation(test, currentRatio, requiredRatio) {
  const isComponent = test.component || false;

  // For disabled text, it's okay to fail as long as it's clearly disabled
  if (test.label.includes('Disabled')) {
    return 'Disabled elements are exempt from WCAG contrast requirements, but ensure they are clearly indicated as disabled through other means (opacity, cursor, etc.)';
  }

  // For tertiary text
  if (test.label.includes('Tertiary')) {
    return 'Consider using secondary text color instead, or ensure tertiary text is only used for non-essential information';
  }

  // For borders and UI components
  if (isComponent) {
    return 'Increase border opacity or use a darker shade to reach 3:1 minimum for UI components';
  }

  // General text
  const gap = requiredRatio / currentRatio;
  if (gap > 1.5) {
    return 'Significant contrast improvement needed - consider using a much darker/lighter shade';
  } else {
    return 'Minor adjustment needed - darken foreground or lighten background slightly';
  }
}
