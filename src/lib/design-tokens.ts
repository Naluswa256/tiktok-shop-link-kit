
// TikTok Commerce Design System Tokens

export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem',  // 8px
  md: '1rem',    // 16px
  lg: '1.5rem',  // 24px
  xl: '2rem',    // 32px
} as const;

export const typography = {
  fontSizes: {
    xs: '0.75rem',   // 12px - Caption
    sm: '0.875rem',  // 14px - Small
    md: '1rem',      // 16px - Body
    lg: '1.25rem',   // 20px - Subhead
    xl: '1.5rem',    // 24px - Heading
    xxl: '2rem',     // 32px - Display
  },
  lineHeights: {
    tight: 1.2,
    base: 1.5,
    relaxed: 1.75,
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const colors = {
  // Brand colors
  primary: {
    DEFAULT: 'hsl(0, 84%, 60%)', // #E60023
    foreground: 'hsl(0, 0%, 100%)',
  },
  secondary: {
    DEFAULT: 'hsl(0, 0%, 0%)', // Rich black
    foreground: 'hsl(0, 0%, 100%)',
  },
  accent: {
    DEFAULT: 'hsl(51, 100%, 50%)', // #FFD700
    foreground: 'hsl(0, 0%, 0%)',
  },
  // Feedback colors
  success: {
    DEFAULT: 'hsl(134, 61%, 41%)', // #28A745
    foreground: 'hsl(0, 0%, 100%)',
  },
  warning: {
    DEFAULT: 'hsl(45, 100%, 51%)', // #FFC107
    foreground: 'hsl(0, 0%, 0%)',
  },
  error: {
    DEFAULT: 'hsl(354, 70%, 54%)', // #DC3545
    foreground: 'hsl(0, 0%, 100%)',
  },
} as const;

export const borderRadius = {
  sm: '4px',
  md: '8px', 
  lg: '16px',
} as const;

export const elevation = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 8px rgba(0,0,0,0.1)',
  lg: '0 8px 16px rgba(0,0,0,0.15)',
} as const;

// Breakpoints for responsive design
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

// Common component patterns
export const patterns = {
  tapTarget: {
    minHeight: '48px',
    minWidth: '48px',
  },
  containerPadding: {
    mobile: '1rem',
    tablet: '1.5rem',
    desktop: '2rem',
  },
} as const;

export type SpacingKey = keyof typeof spacing;
export type TypographySize = keyof typeof typography.fontSizes;
export type ColorKey = keyof typeof colors;
export type RadiusKey = keyof typeof borderRadius;
export type ElevationKey = keyof typeof elevation;
