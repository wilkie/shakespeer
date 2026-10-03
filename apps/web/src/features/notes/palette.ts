import { HIGHLIGHT_COLORS, type HighlightColor } from '@shakespeer/storage';

/**
 * Highlight colors (ANN-010): fixed, in palette order, with light- and dark-mode values chosen
 * so text on them keeps WCAG AA contrast (pale tints under dark text; deep tones under light).
 */
export const HIGHLIGHTS: Record<
  HighlightColor,
  { name: string; light: string; dark: string; mark: string }
> = {
  yellow: { name: 'Yellow', light: '#fff0a0', dark: '#5c4c00', mark: '#e0b400' },
  green: { name: 'Green', light: '#ccefc4', dark: '#1d4a25', mark: '#3f9a4a' },
  blue: { name: 'Blue', light: '#cfe3ff', dark: '#1b3b62', mark: '#3d7fd6' },
  pink: { name: 'Pink', light: '#ffd3e6', dark: '#5c2441', mark: '#d6528d' },
  orange: { name: 'Orange', light: '#ffdcb5', dark: '#5e3810', mark: '#e0812a' },
  purple: { name: 'Purple', light: '#e4d6ff', dark: '#3e2a66', mark: '#8b62d6' },
};

export { HIGHLIGHT_COLORS, type HighlightColor };

/** The CSS variable holding a highlight color for the current color scheme. */
export function highlightVar(color: HighlightColor): string {
  return `var(--hl-${color})`;
}
