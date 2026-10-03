import Visibility from '@mui/icons-material/Visibility';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import { createVersionIndex, getVersionInfo, loadAlignment } from '@shakespeer/corpus';
import { getPosition, savePosition } from '@shakespeer/storage';
import { useEffect, useRef, useState } from 'react';
import { useLoaderData, useLocation, useNavigate } from 'react-router';

import { getDatabase, getSettings } from '@/lib/storage';
import { useSetting } from '@/lib/useSetting';

import { fragmentFor, resolveFragment } from './fragment';
import { NotesPanel, type NotesPanelContent } from './NotesPanel';
import { PlayText } from './PlayText';
import { ReaderTopBar } from './ReaderTopBar';
import { sceneNavigation } from './navigation';
import type { ReaderData } from './routes';
import { SceneMap } from './SceneMap';
import { AboutThisText, SourceDialog } from './SourceInfo';
import { createTermIndex, type TermEntry } from './terms';
import { useCurrentLine } from './useCurrentLine';
import { mapThroughAlignment } from './version-map';

interface NavigationState {
  nodeId?: string;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function nodeElement(nodeId: string): Element | null {
  // Node IDs are plain ASCII without quotes, so they need no escaping.
  return document.querySelector(`[data-node-id="${nodeId}"]`);
}

function scrollToElement(element: Element | null, smooth: boolean) {
  if (!element || typeof element.scrollIntoView !== 'function') {
    return;
  }
  const behavior: ScrollBehavior = smooth && !prefersReducedMotion() ? 'smooth' : 'instant';
  element.scrollIntoView({ block: 'start', behavior });
  if (behavior === 'instant') {
    // Scenes rendered on demand (content-visibility) can shift the target; settle it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    });
  }
}

/** Holding reveals underlines; tapping toggles them (DEF-035). */
function RevealButton({
  revealed,
  onToggle,
  onPeek,
}: {
  revealed: boolean;
  onToggle: () => void;
  onPeek: (peek: boolean) => void;
}) {
  const hold = useRef<{ timer: number; held: boolean } | null>(null);
  return (
    <Fab
      size="small"
      color={revealed ? 'primary' : 'default'}
      aria-label="Show definition underlines"
      aria-pressed={revealed}
      onPointerDown={() => {
        const state = { timer: 0, held: false };
        state.timer = window.setTimeout(() => {
          state.held = true;
          onPeek(true);
        }, 300);
        hold.current = state;
      }}
      onPointerUp={() => {
        const state = hold.current;
        hold.current = null;
        if (!state) {
          return;
        }
        window.clearTimeout(state.timer);
        if (state.held) {
          onPeek(false);
        } else {
          onToggle();
        }
      }}
      onPointerCancel={() => {
        if (hold.current) {
          window.clearTimeout(hold.current.timer);
          hold.current = null;
        }
        onPeek(false);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      sx={{ position: 'fixed', right: 28, bottom: 20, zIndex: (theme) => theme.zIndex.speedDial }}
    >
      {revealed ? <Visibility /> : <VisibilityOutlined />}
    </Fab>
  );
}

export function ReaderPage() {
  const { play, version, doc, definitions } = useLoaderData<ReaderData>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('md'));
  const noHover = useMediaQuery('(hover: none)');

  const index = createVersionIndex(doc);
  const terms = createTermIndex(definitions);

  const textRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const [showUnderlines, setShowUnderlines] = useSetting('definitions.showUnderlines', false);
  const [peek, setPeek] = useState(false);
  const [panel, setPanel] = useState<NotesPanelContent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourceDialog, setSourceDialog] = useState<{ title: string; sourceIds: string[] } | null>(
    null,
  );
  const [restored, setRestored] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  // On phones the top bar slides away while scrolling down (RDR-016).
  const scrolledDown = useScrollTrigger({ threshold: 80 });
  const topBarHidden = isPhone && scrolledDown && panel === null && !menuOpen;

  const topOffset = () => Math.max(0, topBarRef.current?.getBoundingClientRect().bottom ?? 0);
  const lines = useCurrentLine(textRef, topOffset);
  const currentIndex = lines.top === undefined ? undefined : index.indexOf(lines.top);
  const bottomIndex = lines.bottom === undefined ? undefined : index.indexOf(lines.bottom);

  // Publish the top bar's height for scroll margins and sticky offsets.
  useEffect(() => {
    const bar = topBarRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--reader-top', `${String(bar.offsetHeight)}px`);
    });
    observer.observe(bar);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Remember the version used (RDR-041).
  useEffect(() => {
    void getSettings().then((settings) =>
      settings.set(`reader.lastVersion.${play.id}`, version.id),
    );
  }, [play.id, version.id]);

  // Restore the position: URL fragment, then a version switch's target, then the saved line
  // (RDR-032 – RDR-034).
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const target = location.hash ? resolveFragment(index, location.hash) : undefined;
      const stateNode = (location.state as NavigationState | null)?.nodeId;
      if (target?.kind === 'scene') {
        const scene = index.scenes[target.sceneIndex];
        scrollToElement(document.getElementById(`scene-${scene?.scene.id ?? ''}`), false);
      } else {
        const saved =
          target || stateNode
            ? undefined
            : await getPosition(await getDatabase(), play.id, version.id);
        const nodeId = target?.nodeId ?? stateNode ?? saved?.nodeId;
        if (!cancelled && nodeId) {
          scrollToElement(nodeElement(nodeId), false);
        }
      }
      if (!cancelled) {
        setRestored(true);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
    // Only on opening a version; later fragment changes are our own (RDR-031).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.id, version.id]);

  // Track the current line in the URL fragment and saved position (RDR-031, RDR-033).
  useEffect(() => {
    if (!restored || !lines.top) {
      return;
    }
    const nodeId = lines.top;
    const fragmentTimer = window.setTimeout(() => {
      const fragment = fragmentFor(index, nodeId);
      if (fragment) {
        window.history.replaceState(window.history.state, '', `#${fragment}`);
      }
    }, 250);
    const saveTimer = window.setTimeout(() => {
      void getDatabase().then((db) => savePosition(db, play.id, version.id, nodeId));
    }, 1000);
    return () => {
      window.clearTimeout(fragmentTimer);
      window.clearTimeout(saveTimer);
    };
  }, [restored, lines.top, index, play.id, version.id]);

  const openTerms = (element: HTMLElement) => {
    const ids = (element.dataset['terms'] ?? '').split(' ').filter(Boolean);
    const entries = ids
      .map((id) => terms.get(id))
      .filter((entry): entry is TermEntry => entry !== undefined);
    if (entries.length === 0) {
      return;
    }
    opener.current = element;
    setPanel({ terms: entries.map((entry) => [entry]) });
    requestAnimationFrame(() => {
      if (isPhone) {
        // Keep the activated text above the bottom sheet (PNL-003).
        const rect = element.getBoundingClientRect();
        const limit = window.innerHeight * 0.45;
        if (rect.bottom > limit) {
          window.scrollBy({ top: rect.bottom - limit + 16, behavior: 'instant' });
        }
      } else if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    });
  };

  // Delegated activation of terms (DEF-030): one listener instead of thousands.
  useEffect(() => {
    const root = textRef.current;
    if (!root) {
      return;
    }
    const onClick = (event: MouseEvent) => {
      const term = (event.target as Element).closest<HTMLElement>('.term');
      // Don't treat the end of a text selection as a click.
      if (term && (window.getSelection()?.isCollapsed ?? true)) {
        openTerms(term);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const term = (event.target as Element).closest<HTMLElement>('.term');
      if (term && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openTerms(term);
      }
    };
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
    };
  });

  const closePanel = () => {
    setPanel(null);
    const element = opener.current;
    opener.current = null;
    if (element?.tabIndex === 0) {
      element.focus();
    }
  };

  useEffect(() => {
    if (!panel) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  const goToScene = (sceneIndex: number) => {
    const scene = index.scenes[sceneIndex];
    if (!scene) {
      return;
    }
    // The first text node is the scene's start; its heading sits just above it.
    scrollToElement(document.getElementById(`scene-${scene.scene.id}`), true);
  };

  const scrub = (nodeIndex: number) => {
    const node = index.nodes[nodeIndex];
    if (node) {
      scrollToElement(nodeElement(node.id), false);
    }
  };

  /** Switches version, keeping the corresponding place (RDR-040). */
  const switchVersion = async (targetId: string) => {
    const target = getVersionInfo(play.id, targetId);
    if (!target) {
      return;
    }
    let nodeId = lines.top;
    if (nodeId && version.kind === 'original') {
      const alignment = await loadAlignment(play.id, version.id);
      nodeId = alignment && mapThroughAlignment(alignment, nodeId, 'to-modern');
    }
    if (nodeId && target.kind === 'original') {
      const alignment = await loadAlignment(play.id, target.id);
      nodeId = alignment && mapThroughAlignment(alignment, nodeId, 'to-original');
    }
    const state: NavigationState = nodeId ? { nodeId } : {};
    void navigate(`/plays/${play.id}/${target.id}`, { state });
  };

  const navigation = sceneNavigation(index, currentIndex);
  const currentScene =
    currentIndex === undefined
      ? index.scenes[0]
      : index.scenes.find((s) => currentIndex >= s.start && currentIndex < s.end);
  const revealTerms = showUnderlines || peek;

  return (
    <>
      <title>{`${play.title} (${version.shortName}) · Shakespeer`}</title>
      <ReaderTopBar
        ref={topBarRef}
        play={play}
        version={version}
        hidden={topBarHidden}
        onVersion={(id) => {
          void switchVersion(id);
        }}
        showUnderlines={showUnderlines}
        onShowUnderlines={setShowUnderlines}
        onAbout={() => {
          setSourceDialog({ title: 'About this text', sourceIds: version.sourceIds });
        }}
        onMenuOpenChange={setMenuOpen}
        compactScenes={
          isPhone
            ? {
                index,
                current: currentScene,
                previous:
                  navigation.previous === undefined ? undefined : index.scenes[navigation.previous],
                next: navigation.next === undefined ? undefined : index.scenes[navigation.next],
                onScene: goToScene,
                onPrevious: () => {
                  if (navigation.previous !== undefined) {
                    goToScene(navigation.previous);
                  }
                },
                onNext: () => {
                  if (navigation.next !== undefined) {
                    goToScene(navigation.next);
                  }
                },
              }
            : undefined
        }
      />
      <Box
        sx={{
          display: 'flex',
          pt: 'var(--reader-top, 64px)',
          minHeight: '100dvh',
          bgcolor: 'background.default',
        }}
      >
        {panel && !isPhone && (
          <NotesPanel
            content={panel}
            variant="column"
            onClose={closePanel}
            onSource={(sourceId) => {
              setSourceDialog({ title: 'Source', sourceIds: [sourceId] });
            }}
          />
        )}
        <Box component="main" sx={{ flex: 1, minWidth: 0, pr: isPhone ? '20px' : '64px' }}>
          <PlayText
            ref={textRef}
            doc={doc}
            decorations={terms.byNode}
            revealTerms={revealTerms}
            footer={<AboutThisText sourceIds={version.sourceIds} />}
          />
        </Box>
      </Box>
      <Box
        sx={{
          position: 'fixed',
          right: 0,
          top: topBarHidden ? 0 : 'var(--reader-top, 64px)',
          bottom: 0,
          transition: 'top 200ms ease-out',
          bgcolor: 'background.default',
          borderLeft: 1,
          borderColor: 'divider',
          zIndex: (t) => t.zIndex.appBar - 1,
        }}
      >
        <SceneMap
          index={index}
          currentIndex={currentIndex}
          bottomIndex={bottomIndex}
          compact={isPhone}
          onScene={goToScene}
          onScrub={scrub}
        />
      </Box>
      {noHover && !panel && (
        <RevealButton
          revealed={revealTerms}
          onToggle={() => {
            setShowUnderlines(!showUnderlines);
          }}
          onPeek={setPeek}
        />
      )}
      {panel && isPhone && (
        <NotesPanel
          content={panel}
          variant="sheet"
          onClose={closePanel}
          onSource={(sourceId) => {
            setSourceDialog({ title: 'Source', sourceIds: [sourceId] });
          }}
        />
      )}
      <SourceDialog
        title={sourceDialog?.title ?? ''}
        sourceIds={sourceDialog?.sourceIds ?? []}
        open={sourceDialog !== null}
        onClose={() => {
          setSourceDialog(null);
        }}
      />
    </>
  );
}

/** Shown while a version loads. */
export function ReaderLoading() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
      <CircularProgress aria-label="Loading the play" />
    </Box>
  );
}
