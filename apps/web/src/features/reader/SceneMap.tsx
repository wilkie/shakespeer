import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import type { IndexedScene, VersionIndex } from '@shakespeer/corpus';
import type { AnnotationRecord } from '@shakespeer/storage';
import { useEffect, useRef, useState } from 'react';

import { truncate } from '@/features/notes/format';
import { HIGHLIGHT_COLORS, HIGHLIGHTS } from '@/features/notes/palette';

import { MARK_HEIGHT, markGroups } from './map-marks';
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
  /** Annotations to mark along the bar, or none when marks are off (MAP-040, MAP-044). */
  annotations: readonly AnnotationRecord[];
  onMark: (annotations: readonly AnnotationRecord[]) => void;
  /** Scenes the current cut hides entirely, drawn as thin hatched segments (CUT-045). */
  cutScenes?: ReadonlySet<string> | undefined;
}

/** One stripe per color present, in palette order (MAP-042), in the stronger mark tones. */
function stripes(annotations: readonly AnnotationRecord[]): string {
  const colors = HIGHLIGHT_COLORS.filter((c) => annotations.some((a) => a.color === c));
  const step = 100 / colors.length;
  const stops = colors.map(
    (c, i) => `${HIGHLIGHTS[c].mark} ${String(i * step)}% ${String((i + 1) * step)}%`,
  );
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function markLabel(annotations: readonly AnnotationRecord[]): string {
  const [first] = annotations;
  return annotations.length === 1 && first
    ? `Annotation: “${truncate(first.anchor.quote.exact, 40)}”`
    : `${String(annotations.length)} annotations`;
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
  annotations,
  onMark,
  cutScenes,
}: SceneMapProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);
  // One label for the scene under the pointer, drawn inside the fixed map so it never moves
  // with the page (per-segment tooltips re-anchored on every scroll) (MAP-005).
  const [hover, setHover] = useState<{ y: number; sceneIndex: number } | null>(null);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      setBarHeight(bar.clientHeight);
    });
    observer.observe(bar);
    return () => {
      observer.disconnect();
    };
  }, []);
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

  const sceneAtPointer = (clientY: number) => {
    const node = nodeAtPointer(clientY);
    return index.scenes.findIndex((s) => node >= s.start && node < s.end);
  };

  const showLabel = (clientY: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    const sceneIndex = sceneAtPointer(clientY);
    if (rect && sceneIndex >= 0) {
      setHover({ y: clientY - rect.top, sceneIndex });
    }
  };

  const hoverScene = hover ? index.scenes[hover.sceneIndex] : undefined;

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
          if (event.pointerType === 'mouse' || drag.current) {
            showLabel(event.clientY);
          }
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
            const sceneIndex = sceneAtPointer(event.clientY);
            if (sceneIndex >= 0) {
              onScene(sceneIndex);
            }
          }
          drag.current = null;
          if (event.pointerType !== 'mouse') {
            setHover(null);
          }
        }}
        onPointerLeave={() => {
          if (!drag.current) {
            setHover(null);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setHover(null);
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
          const isCut = cutScenes?.has(scene.scene.id) ?? false;
          return (
            <Box
              key={scene.scene.id}
              aria-label={isCut ? `${title} (cut)` : title}
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
                ...(isCut
                  ? {
                      flexGrow: 0,
                      flexBasis: 4,
                      minHeight: 4,
                      bgcolor: 'transparent',
                      backgroundImage:
                        'repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 3px)',
                      color: 'text.disabled',
                    }
                  : {}),
              }}
            />
          );
        })}
        {hover && hoverScene && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              right: 'calc(100% + 12px)',
              top: hover.y,
              transform: 'translateY(-50%)',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'grey.800',
              color: 'common.white',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: 2,
            }}
          >
            {sceneTitle(hoverScene.scene, hoverScene.actN)}
          </Box>
        )}
        {barHeight > 0 &&
          markGroups(index, annotations, barHeight).map((group) => (
            <ButtonBase
              key={group.annotations[0]?.id}
              aria-label={markLabel(group.annotations)}
              // Marks are not part of scrubbing the bar.
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
              }}
              onClick={() => {
                onMark(group.annotations);
              }}
              sx={{
                position: 'absolute',
                top: group.top,
                right: compact ? -3 : -9,
                width: compact ? 4 : 7,
                height: MARK_HEIGHT,
                zIndex: 1,
                backgroundImage: stripes(group.annotations),
                outline: 1,
                outlineColor: 'background.default',
                // A larger touch target than the mark itself.
                '&::before': { content: '""', position: 'absolute', inset: '-4px -4px' },
                '&:hover, &.Mui-focusVisible': { outline: 2, outlineColor: 'text.primary' },
              }}
            />
          ))}
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
