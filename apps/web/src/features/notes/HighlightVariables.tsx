import GlobalStyles from '@mui/material/GlobalStyles';

import { HIGHLIGHT_COLORS, HIGHLIGHTS } from './palette';

const variables = (mode: 'light' | 'dark') =>
  Object.fromEntries(HIGHLIGHT_COLORS.map((c) => [`--hl-${c}`, HIGHLIGHTS[c][mode]]));

/**
 * Highlight colors as page-wide CSS variables, switching with the color scheme (ANN-010), for
 * the text, the panel's swatches and the map's marks alike.
 */
export function HighlightVariables() {
  return (
    <GlobalStyles
      styles={(theme) => ({
        // On body, not :root: the dark scheme's class sits on the root element itself.
        body: { ...variables('light'), ...theme.applyStyles('dark', variables('dark')) },
      })}
    />
  );
}
