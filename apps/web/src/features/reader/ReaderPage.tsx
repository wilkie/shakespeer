import Visibility from '@mui/icons-material/Visibility';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import {
  createVersionIndex,
  getSource,
  getVersionInfo,
  loadAlignment,
  type TextAnchor,
} from '@shakespeer/corpus';
import { getPosition, savePosition, type NoteCounts } from '@shakespeer/storage';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useLoaderData, useLocation, useNavigate } from 'react-router';

import { getDatabase, getSettings } from '@/lib/storage';
import { useSetting } from '@/lib/useSetting';

import {
  CutTextDialog,
  ManageCutsDialog,
  NewCutDialog,
  type CutTextRequest,
} from '@/features/cuts/CutDialogs';
import {
  canReplace,
  editOperationText,
  hideSpan,
  insertAfter,
  nodeSpan,
  removeOperation,
  replaceSpan,
  restoreNodes,
} from '@/features/cuts/operations';
import { editableOperations, useCut } from '@/features/cuts/useCut';
import { variantMarks } from '@/features/variants/marks';
import { useCompare } from '@/features/variants/useCompare';
import { CollectionsDialog } from '@/features/exchange/CollectionsDialog';
import { ExportDialog } from '@/features/exchange/ExportDialog';
import { ImportDialog } from '@/features/exchange/ImportDialog';
import { useCollections } from '@/features/exchange/useCollections';
import { useFileDrop } from '@/features/exchange/useFileDrop';
import { CollectionNamesContext } from '@/features/notes/collectionNames';
import { HighlightVariables } from '@/features/notes/HighlightVariables';
import { createNoteIndex } from '@/features/notes/noteIndex';
import { UnattachedDialog } from '@/features/notes/UnattachedDialog';
import { useNoteCounts } from '@/features/notes/useNoteCounts';
import { useVersionNotes } from '@/features/notes/useVersionNotes';

import { makeAnchor, snapToWords, textBetween, type Position } from './anchors';
import { fragmentFor, resolveFragment } from './fragment';
import { NotesPanel, type NotesPanelProps } from './NotesPanel';
import { PlayText } from './PlayText';
import { ReaderTopBar } from './ReaderTopBar';
import { sceneNavigation } from './navigation';
import type { ReaderData } from './routes';
import { SceneMap } from './SceneMap';
import { AboutThisText, SourceDialog } from './SourceInfo';
import { rangePositions, textSelection } from './selection';
import { SelectionMenu, type CutActions, type SelectedRange } from './SelectionMenu';
import { useCurrentLine } from './useCurrentLine';
import { useNotesPanel } from './useNotesPanel';
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
  // Node IDs are plain ASCII without quotes, so they need no escaping. A node a cut hides is
  // found by its marker (CUT-040), an added one by its own ID (CUT-051).
  return (
    document.querySelector(`[data-node-id="${nodeId}"]`) ??
    document.querySelector(`[data-hides~="${nodeId}"]`) ??
    document.querySelector(`[data-inserted-id="${nodeId}"]`)
  );
}

/** A change a reader activated in a cut's edit mode (CUT-033). */
interface ChangeMenu {
  element: HTMLElement;
  opIds: string[];
  revealKey: string | undefined;
  kind: string | undefined;
}

/** What a text dialog's wording is for. */
type TextTarget =
  | { kind: 'replace'; start: Position; end: Position }
  | { kind: 'insert'; after: string }
  | { kind: 'edit'; opId: string };

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
  const { play, version, doc, definitions, variants, alignment } = useLoaderData<ReaderData>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('md'));
  const noHover = useMediaQuery('(hover: none)');

  const index = createVersionIndex(doc);
  const stored = useVersionNotes(play.id, version.id, index);
  const cut = useCut(play.id, version.id, index);
  // Where the play's variants show in this version (VAR-001 – VAR-003).
  const [showVariantMarks, setShowVariantMarks] = useSetting('variants.showMarks', true);
  const marks = variantMarks(
    index,
    variants,
    version,
    play.versions,
    alignment,
    play.modernVersionId,
  );
  /** Variants whose mark is hovered or focused, outlined in the text (VAR-001). */
  const [outlined, setOutlined] = useState<string[]>([]);
  // Comparing with another version shows both in full (VAR-020, VAR-025).
  const compare = useCompare(play, version, index, alignment);
  const comparing = compare.version !== undefined;
  const display = comparing ? undefined : cut.display;
  // What is displayed: the scene map, navigation and current line follow the cut (CUT-045).
  const shown = display?.index ?? index;
  const [showCutText, setShowCutText] = useSetting('cuts.showCutText', false);
  const [revealed, setRevealed] = useState<{ cutId: string | undefined; keys: Set<string> }>({
    cutId: undefined,
    keys: new Set(),
  });
  const revealedKeys = revealed.cutId === cut.current?.id ? revealed.keys : new Set<string>();
  const toggleReveal = (key: string, open?: boolean) => {
    const keys = new Set(revealedKeys);
    if (open ?? !keys.has(key)) {
      keys.add(key);
    } else {
      keys.delete(key);
    }
    setRevealed({ cutId: cut.current?.id, keys });
  };
  /** Reveals the cut text holding a node, so its notes can be shown (CUT-044). */
  const revealNode = (nodeId: string) => {
    const keys = new Set(revealedKeys);
    const marker = document.querySelector<HTMLElement>(`[data-hides~="${nodeId}"]`);
    if (marker?.dataset['cutReveal']) {
      keys.add(marker.dataset['cutReveal']);
    }
    for (const range of cut.display?.hidden.get(nodeId) ?? []) {
      keys.add(`range:${nodeId}:${String(range.start)}`);
    }
    setRevealed({ cutId: cut.current?.id, keys });
  };
  const [changeMenu, setChangeMenu] = useState<ChangeMenu | null>(null);
  const [textDialog, setTextDialog] = useState<{
    request: CutTextRequest;
    target: TextTarget;
  } | null>(null);
  const [cutDialog, setCutDialog] = useState<'new' | 'manage' | null>(null);
  // Sources switched off show none of their definitions (DEF-012).
  const [enabledSources, setEnabledSources] = useSetting('definitions.enabledSources', {});
  const shownSources = definitions.filter((file) => enabledSources[file.sourceId] !== false);
  const notes = createNoteIndex(index, shownSources, stored.definitions, stored.annotations);
  const noteCounts = useNoteCounts([play.id]).get(play.id) ?? new Map<string, NoteCounts>();

  const textRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const [showUnderlines, setShowUnderlines] = useSetting('definitions.showUnderlines', false);
  const [showMarks, setShowMarks] = useSetting('map.showAnnotationMarks', true);
  const [peek, setPeek] = useState(false);
  const panel = useNotesPanel(play.id, version.id, index, notes);
  const collections = useCollections(play.id);
  const collectionNames = new Map(collections.map((c) => [c.id, c.name]));
  const [dialog, setDialog] = useState<'export' | 'import' | 'collections' | 'unattached' | null>(
    null,
  );
  const [droppedFile, setDroppedFile] = useState<File | undefined>();
  /** The text selected when the overflow menu opened, to attach a note to (ANC-032). */
  const [attachTarget, setAttachTarget] = useState<TextAnchor | undefined>();
  // A notes file dropped on the reader opens the import (IOX-010).
  useFileDrop((file) => {
    setDroppedFile(file);
    setDialog('import');
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourceDialog, setSourceDialog] = useState<{ title: string; sourceIds: string[] } | null>(
    null,
  );
  /** Whether the version's position has been restored; until then, tracking would undo it. */
  const restored = useRef(false);
  const opener = useRef<HTMLElement | null>(null);

  // On phones the top bar slides away while scrolling down (RDR-016).
  const scrolledDown = useScrollTrigger({ threshold: 80 });
  const topBarHidden = isPhone && scrolledDown && !panel.isOpen && !menuOpen;

  const topOffset = () => Math.max(0, topBarRef.current?.getBoundingClientRect().bottom ?? 0);
  const lines = useCurrentLine(textRef, topOffset);
  const currentIndex = lines.top === undefined ? undefined : shown.indexOf(lines.top);
  const bottomIndex = lines.bottom === undefined ? undefined : shown.indexOf(lines.bottom);

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
  // (RDR-032 – RDR-034). It reads the location as it is when a version opens; later fragment
  // changes are our own (RDR-031).
  const restorePosition = useEffectEvent(async (isCancelled: () => boolean) => {
    restored.current = false;
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
      if (!isCancelled() && nodeId) {
        scrollToElement(nodeElement(nodeId), false);
      }
    }
    if (!isCancelled()) {
      restored.current = true;
    }
  });
  useEffect(() => {
    let cancelled = false;
    void restorePosition(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [play.id, version.id]);

  // Track the current line in the URL fragment and saved position (RDR-031, RDR-033).
  useEffect(() => {
    if (!restored.current || !lines.top) {
      return;
    }
    const nodeId = lines.top;
    const fragmentTimer = window.setTimeout(() => {
      const fragment = fragmentFor(shown, nodeId);
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
  }, [lines.top, shown, play.id, version.id]);

  /** Keeps the activated text in view beside or above the panel (PNL-002, PNL-003). */
  const revealInPanel = (element: Element | null, editing: boolean) => {
    requestAnimationFrame(() => {
      if (!element) {
        return;
      }
      if (isPhone) {
        const rect = element.getBoundingClientRect();
        // The sheet opens at half height, taller while editing.
        const limit = window.innerHeight * (editing ? 0.25 : 0.45);
        if (rect.bottom > limit) {
          window.scrollBy({ top: rect.bottom - limit + 16, behavior: 'instant' });
        }
      } else if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    });
  };

  /** Opens every note at an activated piece of text (PNL-010). */
  const openNotes = (element: HTMLElement) => {
    const ids = (name: string) => (element.dataset[name] ?? '').split(' ').filter(Boolean);
    const atPoint = showVariantMarks
      ? ids('variants').flatMap((id) => marks.variant(id) ?? [])
      : [];
    if (panel.openAt(ids('terms'), ids('annotations'), atPoint)) {
      opener.current = element;
      revealInPanel(element, false);
    }
  };

  /** Opens the variants of a mark (VAR-004). */
  const openVariants = (element: HTMLElement) => {
    const found = (element.dataset['variantIds'] ?? '')
      .split(' ')
      .flatMap((id) => marks.variant(id) ?? []);
    if (panel.openAt([], [], found)) {
      opener.current = element;
      revealInPanel(element, false);
    }
  };

  /** Turns a selection into an anchor, snapped to whole words (SELX-005). */
  const selectionAnchor = ({ start, end }: SelectedRange) => {
    const snapped = snapToWords(index, start, end);
    return snapped && makeAnchor(index, snapped.start, snapped.end);
  };

  const fromSelection = (range: SelectedRange, action: 'define' | 'annotate') => {
    const anchor = selectionAnchor(range);
    if (!anchor) {
      return;
    }
    opener.current = null;
    panel[action](anchor);
    revealInPanel(nodeElement(anchor.start.nodeId), true);
  };

  // Editing the current cut (CUT-030 – CUT-034).
  const operations = cut.display ? editableOperations(cut.display) : [];
  const snapped = ({ start, end }: SelectedRange) => snapToWords(index, start, end);
  const cutActions: CutActions | undefined =
    cut.editing && !comparing
      ? {
          onCut: (range) => {
            const span = snapped(range);
            if (span) {
              cut.apply(hideSpan(index, operations, span.start, span.end));
            }
          },
          canReplace: (range) => {
            const span = snapped(range);
            return span !== undefined && canReplace(index, operations, span.start, span.end);
          },
          onReplace: (range) => {
            const span = snapped(range);
            if (span) {
              setTextDialog({
                request: {
                  kind: 'replace',
                  original: textBetween(index, span.start, span.end) ?? '',
                  text: '',
                },
                target: { kind: 'replace', ...span },
              });
            }
          },
          onInsert: (range) => {
            const span = snapped(range);
            setTextDialog({
              request: { kind: 'insert', text: '', insertKind: 'sd', editing: false },
              target: { kind: 'insert', after: span?.end.nodeId ?? range.end.nodeId },
            });
          },
        }
      : undefined;

  /** Scene and speech actions in edit mode (CUT-032). */
  const cutAction = (element: HTMLElement) => {
    const { cutAction: action, scene: sceneId, from, to } = element.dataset;
    const scene = index.scenes.find((s) => s.scene.id === sceneId);
    if (action === 'cut-scene' || action === 'restore-scene') {
      if (!scene) {
        return;
      }
      if (action === 'restore-scene') {
        cut.apply(restoreNodes(index, operations, scene.start, scene.end - 1));
        return;
      }
    }
    const first = action === 'cut-speech' ? index.indexOf(from ?? '') : scene?.start;
    const last = action === 'cut-speech' ? index.indexOf(to ?? '') : (scene?.end ?? 0) - 1;
    const span =
      first === undefined || last === undefined ? undefined : nodeSpan(index, first, last);
    if (span) {
      cut.apply(hideSpan(index, operations, span.start, span.end));
    }
  };

  /** Activating a cut's marker or change (CUT-033, CUT-040). */
  const activateCut = (element: HTMLElement) => {
    if (element.dataset['cutAction']) {
      cutAction(element);
      return;
    }
    const revealKey = element.dataset['cutReveal'];
    if (cut.editing) {
      setChangeMenu({
        element,
        opIds: (element.dataset['cutOps'] ?? '').split(' ').filter(Boolean),
        revealKey,
        kind: element.dataset['cutKind'],
      });
    } else if (revealKey) {
      toggleReveal(revealKey);
    }
  };

  // Delegated activation of terms and highlights (DEF-030, ANN-020): one listener, not thousands.
  useEffect(() => {
    const root = textRef.current;
    if (!root) {
      return;
    }
    const target = (event: Event) =>
      (event.target as Element).closest<HTMLElement>('[data-terms], [data-annotations]');
    const cutTarget = (event: Event) => {
      const element = (event.target as Element).closest<HTMLElement>(
        '[data-cut-action], [data-cut-reveal], [data-cut-ops]',
      );
      // Outside edit mode only markers act; added and replaced text are just read.
      return element && (cut.editing || element.dataset['cutReveal']) ? element : null;
    };
    const variantTarget = (event: Event) =>
      (event.target as Element).closest<HTMLElement>('[data-variant-ids]');
    const onOver = (event: Event) => {
      const ids = (variantTarget(event)?.dataset['variantIds'] ?? '').split(' ').filter(Boolean);
      if (ids.join(' ') !== outlined.join(' ')) {
        setOutlined(ids);
      }
    };
    const onClick = (event: MouseEvent) => {
      // Don't treat the end of a text selection as a click.
      if (!(window.getSelection()?.isCollapsed ?? true)) {
        return;
      }
      const cutElement = cutTarget(event);
      if (cutElement) {
        activateCut(cutElement);
        return;
      }
      const mark = variantTarget(event);
      if (mark) {
        openVariants(mark);
        return;
      }
      const element = target(event);
      if (element) {
        openNotes(element);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      const cutElement = cutTarget(event);
      if (cutElement) {
        if (!cutElement.dataset['cutAction']) {
          event.preventDefault();
          activateCut(cutElement);
        }
        return;
      }
      const mark = variantTarget(event);
      if (mark) {
        event.preventDefault();
        openVariants(mark);
        return;
      }
      const element = target(event);
      if (element) {
        event.preventDefault();
        openNotes(element);
      }
    };
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('pointerover', onOver);
    root.addEventListener('focusin', onOver);
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('focusin', onOver);
    };
  });

  const closePanel = () => {
    panel.close();
    const element = opener.current;
    opener.current = null;
    if (element?.isConnected && element.tabIndex === 0) {
      element.focus();
    }
  };

  // Starting or ending a comparison changes the page's layout: keep the current line (VAR-020).
  const comparedShown = compare.rows !== undefined;
  const keepLine = useEffectEvent(() => {
    if (lines.top) {
      scrollToElement(nodeElement(lines.top), false);
    }
  });
  useEffect(() => {
    keepLine();
  }, [comparedShown]);

  // Escape outside dialogs and menus ends the comparison, once the panel is closed (VAR-020).
  useEffect(() => {
    if (!comparing || panel.isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !(event.target as Element).closest('[role="dialog"], [role="listbox"], [role="menu"]')
      ) {
        compare.select(undefined);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  useEffect(() => {
    if (!panel.isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape inside a dialog or menu belongs to it.
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !(event.target as Element).closest('[role="dialog"], [role="listbox"], [role="menu"]')
      ) {
        closePanel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  const goToScene = (sceneIndex: number) => {
    const scene = shown.scenes[sceneIndex];
    if (!scene) {
      return;
    }
    // The first text node is the scene's start; its heading sits just above it.
    scrollToElement(document.getElementById(`scene-${scene.scene.id}`), true);
  };

  const scrub = (nodeIndex: number) => {
    const node = shown.nodes[nodeIndex];
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

  const navigation = sceneNavigation(shown, currentIndex);
  const currentScene =
    currentIndex === undefined
      ? shown.scenes[0]
      : shown.scenes.find((s) => currentIndex >= s.start && currentIndex < s.end);
  const revealTerms = showUnderlines || peek;
  const panelProps: Omit<NotesPanelProps, 'variant'> = {
    terms: panel.terms,
    annotations: panel.annotations,
    editing: panel.editing,
    focusId: panel.focusId,
    status: panel.status,
    onClose: closePanel,
    onToggleEdit: panel.toggleEdit,
    onCancel: panel.cancel,
    onRetry: panel.retry,
    onSource: (sourceId) => {
      setSourceDialog({ title: 'Source', sourceIds: [sourceId] });
    },
    onAddDefinition: panel.addDefinition,
    onSaveDefinition: panel.saveDefinition,
    onDeleteDefinition: panel.deleteDefinition,
    onSaveAnnotation: panel.saveAnnotation,
    onDeleteAnnotation: panel.deleteAnnotation,
    variants: panel.variants,
    versionId: version.id,
    versions: play.versions,
    onOpenReading: (reading) => {
      // Open in <version>, at the reading (VAR-004).
      const state: NavigationState = reading.start ? { nodeId: reading.start.nodeId } : {};
      panel.close();
      void navigate(`/plays/${play.id}/${reading.versionId}`, { state });
    },
  };

  return (
    <CollectionNamesContext value={collectionNames}>
      <title>{`${play.title} (${version.shortName}) · Shakespeer`}</title>
      <HighlightVariables />
      {showVariantMarks && outlined.length > 0 && (
        <style>
          {outlined
            .map(
              (id) =>
                `[data-variants~="${id}"] { outline: 1px dashed var(--mui-palette-secondary-main); outline-offset: 1px; }`,
            )
            .join('\n')}
        </style>
      )}
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
        showAnnotationMarks={showMarks}
        onShowAnnotationMarks={setShowMarks}
        noteCounts={noteCounts}
        definitionSources={definitions.map((file) => ({
          id: file.sourceId,
          name: getSource(file.sourceId)?.shortName ?? file.sourceId,
          enabled: enabledSources[file.sourceId] !== false,
        }))}
        onDefinitionSource={(id, enabled) => {
          setEnabledSources({ ...enabledSources, [id]: enabled });
        }}
        onExport={() => {
          setDialog('export');
        }}
        onImport={() => {
          setDroppedFile(undefined);
          setDialog('import');
        }}
        onCollections={() => {
          setDialog('collections');
        }}
        unattachedCount={stored.unattached.length}
        onUnattached={() => {
          setDialog('unattached');
        }}
        onAbout={() => {
          setSourceDialog({ title: 'About this text', sourceIds: version.sourceIds });
        }}
        onMenuOpenChange={(open) => {
          setMenuOpen(open);
          if (open) {
            // What is selected as a menu opens, before choosing an item can clear it.
            const root = textRef.current;
            const range = root ? textSelection(root) : undefined;
            const positions = root && range ? rangePositions(root, range) : undefined;
            setAttachTarget(positions && selectionAnchor(positions));
          }
        }}
        compactScenes={
          isPhone
            ? {
                index: shown,
                current: currentScene,
                previous:
                  navigation.previous === undefined ? undefined : shown.scenes[navigation.previous],
                next: navigation.next === undefined ? undefined : shown.scenes[navigation.next],
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
        cuts={cut.cuts}
        currentCut={cut.current}
        onCut={(cutId) => {
          cut.select(cutId);
        }}
        onNewCut={() => {
          setCutDialog('new');
        }}
        onManageCuts={() => {
          setCutDialog('manage');
        }}
        editingCut={cut.editing}
        onEditCut={cut.setEditing}
        canUndo={cut.canUndo}
        onUndo={cut.undo}
        showCutText={showCutText}
        onShowCutText={setShowCutText}
        hasVariants={variants.length > 0}
        compareWith={compare.version}
        onCompare={compare.select}
        exactSpelling={compare.exact}
        onExactSpelling={compare.setExact}
        showVariantMarks={showVariantMarks}
        onShowVariantMarks={setShowVariantMarks}
      />
      <Box
        sx={{
          display: 'flex',
          pt: 'var(--reader-top, 64px)',
          minHeight: '100dvh',
          bgcolor: 'background.default',
        }}
      >
        {panel.isOpen && !isPhone && <NotesPanel {...panelProps} variant="column" />}
        <Box component="main" sx={{ flex: 1, minWidth: 0, pr: isPhone ? '20px' : '64px' }}>
          <PlayText
            ref={textRef}
            doc={doc}
            notes={notes}
            revealTerms={revealTerms}
            footer={<AboutThisText sourceIds={version.sourceIds} />}
            variants={showVariantMarks ? marks : undefined}
            compare={
              compare.version && compare.rows && compare.right
                ? {
                    rows: compare.rows,
                    left: index,
                    right: compare.right,
                    rightShortName: compare.version.shortName,
                    exact: compare.exact,
                  }
                : undefined
            }
            cut={
              display && {
                display,
                revealed: revealedKeys,
                showCutText,
                editing: cut.editing,
              }
            }
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
          index={shown}
          cutScenes={display?.cutScenes}
          currentIndex={currentIndex}
          bottomIndex={bottomIndex}
          compact={isPhone}
          onScene={goToScene}
          onScrub={scrub}
          annotations={showMarks ? stored.annotations : []}
          onMark={(marked) => {
            // Scroll to the annotation and open it (MAP-043).
            const [first] = marked;
            if (!first) {
              return;
            }
            revealNode(first.anchor.start.nodeId);
            const element = nodeElement(first.anchor.start.nodeId);
            scrollToElement(element, false);
            opener.current = null;
            panel.openAt(
              [],
              marked.map((a) => a.id),
            );
            revealInPanel(element, false);
          }}
        />
      </Box>
      {noHover && !panel.isOpen && (
        <RevealButton
          revealed={revealTerms}
          onToggle={() => {
            setShowUnderlines(!showUnderlines);
          }}
          onPeek={setPeek}
        />
      )}
      {panel.isOpen && isPhone && <NotesPanel {...panelProps} variant="sheet" />}
      <SelectionMenu
        root={textRef}
        topOffset={topOffset}
        onDefine={(range) => {
          fromSelection(range, 'define');
        }}
        onAnnotate={(range) => {
          fromSelection(range, 'annotate');
        }}
        cutActions={cutActions}
      />
      <Menu
        anchorEl={changeMenu?.element}
        open={changeMenu !== null}
        onClose={() => {
          setChangeMenu(null);
        }}
      >
        {changeMenu?.revealKey && (
          <MenuItem
            onClick={() => {
              setChangeMenu(null);
              toggleReveal(changeMenu.revealKey ?? '');
            }}
          >
            <ListItemText
              primary={
                showCutText || revealedKeys.has(changeMenu.revealKey) ? 'Hide text' : 'Show text'
              }
            />
          </MenuItem>
        )}
        {changeMenu &&
          (changeMenu.kind === 'replace' || changeMenu.kind === 'insert') &&
          changeMenu.opIds[0] && (
            <MenuItem
              onClick={() => {
                const op = operations.find((o) => o.id === changeMenu.opIds[0]);
                setChangeMenu(null);
                if (op?.type === 'replace') {
                  setTextDialog({
                    request: { kind: 'replace', original: op.anchor.quote.exact, text: op.text },
                    target: { kind: 'edit', opId: op.id },
                  });
                } else if (op?.type === 'insert') {
                  setTextDialog({
                    request: { kind: 'insert', text: op.text, insertKind: op.kind, editing: true },
                    target: { kind: 'edit', opId: op.id },
                  });
                }
              }}
            >
              <ListItemText primary="Edit…" />
            </MenuItem>
          )}
        <MenuItem
          onClick={() => {
            const ids = changeMenu?.opIds ?? [];
            setChangeMenu(null);
            cut.apply(ids.reduce((ops, id) => removeOperation(ops, id), operations));
          }}
        >
          <ListItemText primary="Restore" />
        </MenuItem>
      </Menu>
      <CutTextDialog
        request={textDialog?.request ?? null}
        onClose={() => {
          setTextDialog(null);
        }}
        onSave={(text, insertKind) => {
          const target = textDialog?.target;
          setTextDialog(null);
          if (target?.kind === 'replace') {
            cut.apply(replaceSpan(index, operations, target.start, target.end, text));
          } else if (target?.kind === 'insert') {
            cut.apply(insertAfter(operations, target.after, insertKind, text));
          } else if (target?.kind === 'edit') {
            cut.apply(editOperationText(operations, target.opId, text));
          }
        }}
      />
      <NewCutDialog
        open={cutDialog === 'new'}
        playId={play.id}
        versionId={version.id}
        onClose={() => {
          setCutDialog(null);
        }}
        onCreated={(created) => {
          setCutDialog(null);
          cut.select(created.id, { edit: true });
        }}
      />
      <ManageCutsDialog
        open={cutDialog === 'manage'}
        cuts={cut.cuts}
        index={index}
        onClose={() => {
          setCutDialog(null);
        }}
      />
      <SourceDialog
        title={sourceDialog?.title ?? ''}
        sourceIds={sourceDialog?.sourceIds ?? []}
        open={sourceDialog !== null}
        onClose={() => {
          setSourceDialog(null);
        }}
      />
      <ExportDialog
        open={dialog === 'export'}
        play={play}
        onClose={() => {
          setDialog(null);
        }}
      />
      <ImportDialog
        open={dialog === 'import'}
        initialFile={droppedFile}
        currentPlayId={play.id}
        onClose={() => {
          setDialog(null);
        }}
        onImported={(playId) => {
          // Notes for another play open that play (IOX-013).
          if (playId !== play.id) {
            void navigate(`/plays/${playId}`);
          }
        }}
      />
      <CollectionsDialog
        open={dialog === 'collections'}
        collections={collections}
        onClose={() => {
          setDialog(null);
        }}
      />
      <UnattachedDialog
        open={dialog === 'unattached'}
        notes={stored.unattached}
        selection={attachTarget}
        onClose={() => {
          setDialog(null);
        }}
      />
    </CollectionNamesContext>
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
