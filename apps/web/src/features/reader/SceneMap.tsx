import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import type { IndexedScene, VersionIndex } from '@shakespeer/corpus';
import { useRef } from 'react';

import { sceneNavigation } from './navigation';
import { sceneShortTitle, sceneTitle } from './titles';

export interface SceneMapProps {
  index: VersionIndex;
  /** Sequence index of the current line (RDR-030). */
  currentIndex: number | undefined;
  /** Sequence index of the node at the bottom of the viewport. */
  bottomIndex: number | undefined;
  compact: boolean;
  onScene: (sceneIndex: number) => void;
  /** Scrubbing: jump to a node index without animation (MAP-021). */
  onScrub: (nodeIndex: number) => void;
}

function NavButton({
  direction,
  scene,
  onClick,
}: {
  direction: 'previous' | 'next';
  scene: IndexedScene | undefined;
  onClick: () => void;
}) {
  const title = scene ? sceneTitle(scene.scene, scene.actN) : undefined;
  const label = title ? `${direction === 'previous' ? 'Previous' : 'Next'}: ${title}` : undefined;
  const Icon = direction === 'previous' ? KeyboardArrowUp : KeyboardArrowDown;
  const button = (
    <ButtonBase
      onClick={onClick}
      disabled={!scene}
      aria-label={label ?? (direction === 'previous' ? 'No previous scene' : 'No next scene')}
      sx={{
        flexDirection: direction === 'previous' ? 'column' : 'column-reverse',
        py: 0.5,
        width: '100%',
        borderRadius: 1,
        color: 'text.secondary',
        fontSize: '0.75rem',
        '&.Mui-disabled': { opacity: 0.35 },
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Icon fontSize="small" />
      <span>{scene ? sceneShortTitle(scene.scene, scene.actN) : '—'}</span>
    </ButtonBase>
  );
  return label ? (
    <Tooltip title={label} placement="left">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

/** The vertical map of the play's scenes at the right edge (MAP-001 – MAP-025, MAP-050). */
export function SceneMap({
  index,
  currentIndex,
  bottomIndex,
  compact,
  onScene,
  onScrub,
}: SceneMapProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);
  const total = Math.max(1, index.nodes.length);
  const navigation = sceneNavigation(index, currentIndex);
  const currentScene =
    currentIndex === undefined
      ? -1
      : index.scenes.findIndex((s) => currentIndex >= s.start && currentIndex < s.end);

  const nodeAtPointer = (clientY: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) {
      return 0;
    }
    const fraction = Math.min(0.9999, Math.max(0, (clientY - rect.top) / rect.height));
    return Math.floor(fraction * total);
  };

  const viewportTop = ((currentIndex ?? 0) / total) * 100;
  const viewportHeight = Math.max(
    0.6,
    (((bottomIndex ?? currentIndex ?? 0) - (currentIndex ?? 0) + 1) / total) * 100,
  );

  return (
    <Box
      component="nav"
      aria-label="Scenes"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        height: '100%',
        width: compact ? 16 : 56,
        py: compact ? 0.5 : 0,
      }}
    >
      {!compact && (
        <NavButton
          direction="previous"
          scene={navigation.previous === undefined ? undefined : index.scenes[navigation.previous]}
          onClick={() => {
            if (navigation.previous !== undefined) {
              onScene(navigation.previous);
            }
          }}
        />
      )}
      <Box
        ref={barRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { startY: event.clientY, moved: false };
        }}
        onPointerMove={(event) => {
          if (
            drag.current &&
            (drag.current.moved || Math.abs(event.clientY - drag.current.startY) > 4)
          ) {
            drag.current.moved = true;
            onScrub(nodeAtPointer(event.clientY));
          }
        }}
        onPointerUp={(event) => {
          if (drag.current && !drag.current.moved) {
            // A click goes to the start of the scene under the pointer (MAP-020).
            const node = nodeAtPointer(event.clientY);
            const sceneIndex = index.scenes.findIndex((s) => node >= s.start && node < s.end);
            if (sceneIndex >= 0) {
              onScene(sceneIndex);
            }
          }
          drag.current = null;
        }}
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          mx: compact ? '3px' : 1.5,
          my: compact ? 0 : 0.5,
          cursor: 'pointer',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {index.scenes.map((scene, i) => {
          const actBoundary = i > 0 && index.scenes[i - 1]?.actN !== scene.actN;
          const title = sceneTitle(scene.scene, scene.actN);
          return (
            <Tooltip key={scene.scene.id} title={title} placement="left" disableInteractive>
              <Box
                aria-label={title}
                aria-current={i === currentScene ? 'location' : undefined}
                sx={{
                  flexGrow: Math.max(1, scene.end - scene.start),
                  flexBasis: 0,
                  minHeight: 2,
                  borderTop: i === 0 ? 0 : actBoundary ? 2 : 1,
                  borderColor: actBoundary ? 'text.secondary' : 'background.default',
                  bgcolor: i === currentScene ? 'primary.main' : 'action.selected',
                  opacity: i === currentScene ? 0.55 : 1,
                  borderRadius: '2px',
                }}
              />
            </Tooltip>
          );
        })}
        {currentIndex !== undefined && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              left: compact ? -3 : -6,
              right: compact ? -3 : -6,
              top: `${String(viewportTop)}%`,
              height: `${String(viewportHeight)}%`,
              minHeight: 4,
              border: 2,
              borderColor: 'primary.main',
              borderRadius: 1,
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>
      {!compact && (
        <NavButton
          direction="next"
          scene={navigation.next === undefined ? undefined : index.scenes[navigation.next]}
          onClick={() => {
            if (navigation.next !== undefined) {
              onScene(navigation.next);
            }
          }}
        />
      )}
    </Box>
  );
}
