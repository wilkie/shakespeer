import { createTheme } from '@mui/material/styles';

const serif = '"EB Garamond Variable", "EB Garamond", Georgia, "Times New Roman", serif';
const sans = '"Roboto Variable", Roboto, system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * App theme. Uses CSS variables + `colorSchemes` so light/dark switch without re-rendering
 * and without a flash on load. Headings use a serif face suited to the source texts.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#5b2a86' },
        secondary: { main: '#a4373a' },
        background: { default: '#faf7f2', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#c9a7eb' },
        secondary: { main: '#e8999b' },
        background: { default: '#16131a', paper: '#1f1b24' },
      },
    },
  },
  typography: {
    fontFamily: sans,
    h1: { fontFamily: serif, fontWeight: 600 },
    h2: { fontFamily: serif, fontWeight: 600 },
    h3: { fontFamily: serif, fontWeight: 600 },
    h4: { fontFamily: serif, fontWeight: 600 },
    h5: { fontFamily: serif, fontWeight: 600 },
    h6: { fontFamily: serif, fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
});
