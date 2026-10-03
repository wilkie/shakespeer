import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlined from '@mui/icons-material/SettingsBrightnessOutlined';
import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';

type Mode = 'light' | 'dark' | 'system';

const NEXT_MODE: Record<Mode, Mode> = { system: 'light', light: 'dark', dark: 'system' };

const ICONS: Record<Mode, React.ReactElement> = {
  system: <SettingsBrightnessOutlined />,
  light: <LightModeOutlined />,
  dark: <DarkModeOutlined />,
};

/** Cycles system → light → dark. MUI persists the choice in localStorage. */
export function ColorModeToggle() {
  const { mode, setMode } = useColorScheme();

  // `mode` is undefined until MUI has read the stored preference on the client.
  if (!mode) {
    return null;
  }

  const next = NEXT_MODE[mode];
  const label = `Color mode: ${mode}. Switch to ${next}.`;

  return (
    <Tooltip title={label}>
      <IconButton
        color="inherit"
        aria-label={label}
        onClick={() => {
          setMode(next);
        }}
      >
        {ICONS[mode]}
      </IconButton>
    </Tooltip>
  );
}
