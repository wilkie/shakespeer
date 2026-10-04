import ArrowBack from '@mui/icons-material/ArrowBack';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import ContentCut from '@mui/icons-material/ContentCut';
import Undo from '@mui/icons-material/Undo';
import MoreVert from '@mui/icons-material/MoreVert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { IndexedScene, PlayInfo, VersionInfo, VersionIndex } from '@shakespeer/corpus';
import type { NoteCounts } from '@shakespeer/storage';
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
  /** Note counts per version, for the version switcher (RDR-042). */
  noteCounts: ReadonlyMap<string, NoteCounts>;
  /** Sources of this version's sourced definitions, each switchable (DEF-012). */
  definitionSources: readonly { id: string; name: string; enabled: boolean }[];
  onDefinitionSource: (id: string, enabled: boolean) => void;
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
  /** The version's cuts and the current one; undefined is Full play (CUT-020). */
  cuts: readonly { id: string; name: string }[];
  currentCut: { id: string; name: string } | undefined;
  onCut: (cutId: string | undefined) => void;
  onNewCut: () => void;
  onManageCuts: () => void;
  /** Edit mode for the current cut, with undo (CUT-030). */
  editingCut: boolean;
  onEditCut: (editing: boolean) => void;
  canUndo: boolean;
  onUndo: () => void;
  showCutText: boolean;
  onShowCutText: (value: boolean) => void;
  /** Whether the play has curated variants, which can be marked (VAR-003). */
  hasVariants: boolean;
  showVariantMarks: boolean;
  onShowVariantMarks: (value: boolean) => void;
}

const subtleButton = {
  p: 0,
  minWidth: 0,
  textTransform: 'none',
  color: 'text.secondary',
  fontWeight: 400,
} as const;

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
/** "12 notes" or "12 notes, 3 imported" for a version (RDR-042); empty without notes. */
function notesLabel(counts: NoteCounts | undefined): string {
  const total = (counts?.own ?? 0) + (counts?.imported ?? 0);
  if (total === 0) {
    return '';
  }
  const notes = `${String(total)} ${total === 1 ? 'note' : 'notes'}`;
  return counts?.imported ? `${notes}, ${String(counts.imported)} imported` : notes;
}

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
  noteCounts,
  definitionSources,
  onDefinitionSource,
  onExport,
  onImport,
  onCollections,
  unattachedCount,
  onUnattached,
  onAbout,
  onMenuOpenChange,
  compactScenes,
  cuts,
  currentCut,
  onCut,
  onNewCut,
  onManageCuts,
  editingCut,
  onEditCut,
  canUndo,
  onUndo,
  showCutText,
  onShowCutText,
  hasVariants,
  showVariantMarks,
  onShowVariantMarks,
}: ReaderTopBarProps) {
  const [versionAnchor, setVersionAnchor] = useState<HTMLElement | null>(null);
  const [cutAnchor, setCutAnchor] = useState<HTMLElement | null>(null);
  const setCutMenu = (element: HTMLElement | null) => {
    setCutAnchor(element);
    onMenuOpenChange(element !== null);
  };
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
            <Button
              size="small"
              color="inherit"
              aria-haspopup="menu"
              aria-label={`Version: ${version.name}. Change version`}
              onClick={(event) => {
                setVersionMenu(event.currentTarget);
              }}
              sx={subtleButton}
            >
              {version.name} ▾
            </Button>
            <Button
              size="small"
              color="inherit"
              aria-haspopup="menu"
              aria-label={`Cut: ${currentCut?.name ?? 'Full play'}. Change cut`}
              onClick={(event) => {
                setCutMenu(event.currentTarget);
              }}
              sx={subtleButton}
            >
              {currentCut?.name ?? 'Full play'} ▾
            </Button>
            <Menu
              anchorEl={cutAnchor}
              open={cutAnchor !== null}
              onClose={() => {
                setCutMenu(null);
              }}
            >
              {[{ id: undefined, name: 'Full play' }, ...cuts].map((option) => (
                <MenuItem
                  key={option.id ?? ''}
                  selected={option.id === currentCut?.id}
                  onClick={() => {
                    setCutMenu(null);
                    if (option.id !== currentCut?.id) {
                      onCut(option.id);
                    }
                  }}
                >
                  <ListItemText primary={option.name} />
                </MenuItem>
              ))}
              <Divider />
              <MenuItem
                onClick={() => {
                  setCutMenu(null);
                  onNewCut();
                }}
              >
                <ListItemText primary="New cut…" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setCutMenu(null);
                  onManageCuts();
                }}
              >
                <ListItemText primary="Manage cuts…" />
              </MenuItem>
            </Menu>
          </Box>
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
                  secondary={[
                    option.kind === 'modern' ? 'Modern spelling' : 'Original spelling',
                    notesLabel(noteCounts.get(option.id)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </MenuItem>
            ))}
          </Menu>
        </Box>
        {currentCut && editingCut && (
          <Tooltip title="Undo">
            <span>
              <IconButton aria-label="Undo" disabled={!canUndo} onClick={onUndo}>
                <Undo />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {currentCut && (
          <Tooltip title={editingCut ? 'Stop editing the cut' : 'Edit cut'}>
            <IconButton
              aria-label="Edit cut"
              aria-pressed={editingCut}
              color={editingCut ? 'primary' : 'default'}
              onClick={() => {
                onEditCut(!editingCut);
              }}
            >
              <ContentCut />
            </IconButton>
          </Tooltip>
        )}
        <IconButton
          aria-label="More actions"
          aria-haspopup="menu"
          edge="end"
          // Keep any text selection: Unattached notes attaches to it (ANC-032).
          onMouseDown={(event) => {
            event.preventDefault();
          }}
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
          {hasVariants && (
            <MenuItem
              role="menuitemcheckbox"
              aria-checked={showVariantMarks}
              onClick={() => {
                onShowVariantMarks(!showVariantMarks);
              }}
            >
              <ListItemIcon>
                <Switch
                  size="small"
                  checked={showVariantMarks}
                  tabIndex={-1}
                  slotProps={{ input: { 'aria-hidden': true } }}
                />
              </ListItemIcon>
              <ListItemText primary="Show variant marks" />
            </MenuItem>
          )}
          {currentCut && (
            <MenuItem
              role="menuitemcheckbox"
              aria-checked={showCutText}
              onClick={() => {
                onShowCutText(!showCutText);
              }}
            >
              <ListItemIcon>
                <Switch
                  size="small"
                  checked={showCutText}
                  tabIndex={-1}
                  slotProps={{ input: { 'aria-hidden': true } }}
                />
              </ListItemIcon>
              <ListItemText primary="Show cut text" />
            </MenuItem>
          )}
          {definitionSources.length > 0 && <Divider />}
          {definitionSources.length > 0 && (
            <ListSubheader sx={{ lineHeight: 2.5, bgcolor: 'transparent' }}>
              Definition sources
            </ListSubheader>
          )}
          {definitionSources.map((source) => (
            <MenuItem
              key={source.id}
              role="menuitemcheckbox"
              aria-checked={source.enabled}
              onClick={() => {
                onDefinitionSource(source.id, !source.enabled);
              }}
            >
              <ListItemIcon>
                <Switch
                  size="small"
                  checked={source.enabled}
                  tabIndex={-1}
                  slotProps={{ input: { 'aria-hidden': true } }}
                />
              </ListItemIcon>
              <ListItemText primary={source.name} />
            </MenuItem>
          ))}
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
