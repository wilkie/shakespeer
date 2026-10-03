import ArrowBack from '@mui/icons-material/ArrowBack';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import MoreVert from '@mui/icons-material/MoreVert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { IndexedScene, PlayInfo, VersionInfo, VersionIndex } from '@shakespeer/corpus';
import { useState, type Ref } from 'react';
import { Link as RouterLink } from 'react-router';

import { sceneTitle } from './titles';

export interface CompactSceneControl {
  index: VersionIndex;
  current: IndexedScene | undefined;
  previous: IndexedScene | undefined;
  next: IndexedScene | undefined;
  onScene: (sceneIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export interface ReaderTopBarProps {
  ref?: Ref<HTMLDivElement>;
  play: PlayInfo;
  version: VersionInfo;
  hidden: boolean;
  onVersion: (versionId: string) => void;
  showUnderlines: boolean;
  onShowUnderlines: (value: boolean) => void;
  showAnnotationMarks: boolean;
  onShowAnnotationMarks: (value: boolean) => void;
  onExport: () => void;
  onImport: () => void;
  onCollections: () => void;
  /** Notes whose text cannot be found (ANC-032); the item shows only when there are some. */
  unattachedCount: number;
  onUnattached: () => void;
  onAbout: () => void;
  onMenuOpenChange: (open: boolean) => void;
  /** On phones, previous/next scene controls live in the top bar (MAP-051). */
  compactScenes: CompactSceneControl | undefined;
}

function SceneRow({
  control,
  onMenuOpenChange,
}: {
  control: CompactSceneControl;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const label = (scene: IndexedScene | undefined) =>
    scene ? sceneTitle(scene.scene, scene.actN) : '';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1,
        pb: 0.5,
      }}
    >
      <IconButton
        size="small"
        disabled={!control.previous}
        aria-label={control.previous ? `Previous: ${label(control.previous)}` : 'No previous scene'}
        onClick={control.onPrevious}
      >
        <ChevronLeft />
      </IconButton>
      <Button
        size="small"
        color="inherit"
        aria-haspopup="menu"
        onClick={(event) => {
          setAnchor(event.currentTarget);
          onMenuOpenChange(true);
        }}
        sx={{ textTransform: 'none' }}
      >
        {label(control.current) || 'Scenes'}
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
          onMenuOpenChange(false);
        }}
        slotProps={{ paper: { sx: { maxHeight: '70dvh' } } }}
      >
        {control.index.scenes.map((scene, i) => (
          <MenuItem
            key={scene.scene.id}
            selected={scene === control.current}
            onClick={() => {
              setAnchor(null);
              onMenuOpenChange(false);
              control.onScene(i);
            }}
          >
            {sceneTitle(scene.scene, scene.actN)}
          </MenuItem>
        ))}
      </Menu>
      <IconButton
        size="small"
        disabled={!control.next}
        aria-label={control.next ? `Next: ${label(control.next)}` : 'No next scene'}
        onClick={control.onNext}
      >
        <ChevronRight />
      </IconButton>
    </Box>
  );
}

/** The reader's top bar (RDR-010 – RDR-016). */
export function ReaderTopBar({
  ref,
  play,
  version,
  hidden,
  onVersion,
  showUnderlines,
  onShowUnderlines,
  showAnnotationMarks,
  onShowAnnotationMarks,
  onExport,
  onImport,
  onCollections,
  unattachedCount,
  onUnattached,
  onAbout,
  onMenuOpenChange,
  compactScenes,
}: ReaderTopBarProps) {
  const [versionAnchor, setVersionAnchor] = useState<HTMLElement | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const setMenu = (element: HTMLElement | null) => {
    setMenuAnchor(element);
    onMenuOpenChange(element !== null);
  };
  const setVersionMenu = (element: HTMLElement | null) => {
    setVersionAnchor(element);
    onMenuOpenChange(element !== null);
  };

  return (
    <AppBar
      ref={ref}
      position="fixed"
      color="default"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transform: hidden ? 'translateY(-100%)' : 'none',
        transition: 'transform 200ms ease-out',
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <Tooltip title="All plays">
          <IconButton component={RouterLink} to="/" edge="start" aria-label="All plays">
            <ArrowBack />
          </IconButton>
        </Tooltip>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" component="h1" noWrap sx={{ lineHeight: 1.2 }}>
            {play.title}
          </Typography>
          <Button
            size="small"
            color="inherit"
            aria-haspopup="menu"
            aria-label={`Version: ${version.name}. Change version`}
            onClick={(event) => {
              setVersionMenu(event.currentTarget);
            }}
            sx={{
              p: 0,
              minWidth: 0,
              textTransform: 'none',
              color: 'text.secondary',
              fontWeight: 400,
            }}
          >
            {version.name} ▾
          </Button>
          <Menu
            anchorEl={versionAnchor}
            open={versionAnchor !== null}
            onClose={() => {
              setVersionMenu(null);
            }}
          >
            {play.versions.map((option) => (
              <MenuItem
                key={option.id}
                selected={option.id === version.id}
                onClick={() => {
                  setVersionMenu(null);
                  if (option.id !== version.id) {
                    onVersion(option.id);
                  }
                }}
              >
                <ListItemText
                  primary={option.name}
                  secondary={option.kind === 'modern' ? 'Modern spelling' : 'Original spelling'}
                />
              </MenuItem>
            ))}
          </Menu>
        </Box>
        <IconButton
          aria-label="More actions"
          aria-haspopup="menu"
          edge="end"
          onClick={(event) => {
            setMenu(event.currentTarget);
          }}
        >
          <MoreVert />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={menuAnchor !== null}
          onClose={() => {
            setMenu(null);
          }}
        >
          <MenuItem
            role="menuitemcheckbox"
            aria-checked={showUnderlines}
            onClick={() => {
              onShowUnderlines(!showUnderlines);
            }}
          >
            <ListItemIcon>
              <Switch
                size="small"
                checked={showUnderlines}
                tabIndex={-1}
                slotProps={{ input: { 'aria-hidden': true } }}
              />
            </ListItemIcon>
            <ListItemText primary="Show definition underlines" />
          </MenuItem>
          <MenuItem
            role="menuitemcheckbox"
            aria-checked={showAnnotationMarks}
            onClick={() => {
              onShowAnnotationMarks(!showAnnotationMarks);
            }}
          >
            <ListItemIcon>
              <Switch
                size="small"
                checked={showAnnotationMarks}
                tabIndex={-1}
                slotProps={{ input: { 'aria-hidden': true } }}
              />
            </ListItemIcon>
            <ListItemText primary="Show annotation marks on map" />
          </MenuItem>
          <Divider />
          {(
            [
              ['Export notes…', onExport],
              ['Import notes…', onImport],
              ['Imported collections…', onCollections],
            ] as const
          ).map(([label, action]) => (
            <MenuItem
              key={label}
              onClick={() => {
                setMenu(null);
                action();
              }}
            >
              <ListItemText primary={label} />
            </MenuItem>
          ))}
          {unattachedCount > 0 && (
            <MenuItem
              onClick={() => {
                setMenu(null);
                onUnattached();
              }}
            >
              <ListItemText primary={`Unattached notes (${String(unattachedCount)})`} />
            </MenuItem>
          )}
          <Divider />
          <MenuItem
            onClick={() => {
              setMenu(null);
              onAbout();
            }}
          >
            <ListItemText primary="About this text" />
          </MenuItem>
        </Menu>
      </Toolbar>
      {compactScenes && <SceneRow control={compactScenes} onMenuOpenChange={onMenuOpenChange} />}
    </AppBar>
  );
}
