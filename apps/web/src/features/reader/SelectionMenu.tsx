import Bookmark from '@mui/icons-material/BorderColor';
import MenuBook from '@mui/icons-material/MenuBookOutlined';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import { useEffect, useRef, useState, type RefObject } from 'react';

import type { Position } from './anchors';
import { rangePositions, textSelection } from './selection';

export interface SelectedRange {
  start: Position;
  end: Position;
}

interface MenuState {
  range: SelectedRange;
  top: number;
  left: number;
}

const GAP = 8;
const MENU_HEIGHT = 40;
const MENU_WIDTH = 300;

/** Where the menu goes for a selection, in viewport coordinates (SELX-008, SELX-009). */
function placement(
  range: Range,
  touch: boolean,
  topLimit: number,
): { top: number; left: number } | undefined {
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
  const whole = range.getBoundingClientRect();
  const last = rects.at(-1) ?? whole;
  if (whole.bottom < topLimit || whole.top > window.innerHeight) {
    return undefined; // Scrolled away (SELX-010).
  }
  const clampLeft = (x: number) => Math.max(GAP, Math.min(x, window.innerWidth - MENU_WIDTH - GAP));
  if (touch) {
    // Below the selection, clear of the platform's own callout above it.
    return {
      top: Math.min(whole.bottom + GAP * 3, window.innerHeight - MENU_HEIGHT - GAP),
      left: clampLeft(whole.left),
    };
  }
  const above = last.top - MENU_HEIGHT - GAP;
  return {
    top: above >= topLimit ? above : last.bottom + GAP,
    left: clampLeft(last.right - MENU_WIDTH / 2),
  };
}

export interface SelectionMenuProps {
  /** The play text; selections outside it are ignored (SELX-003). */
  root: RefObject<HTMLElement | null>;
  /** The bottom of anything fixed over the text, which the menu must not hide under. */
  topOffset: () => number;
  onDefine: (range: SelectedRange) => void;
  onAnnotate: (range: SelectedRange) => void;
}

/**
 * The selection menu (SELX-002, SELX-008 – SELX-011): appears for a non-empty selection in the
 * play text, offering Add definition and Add annotation.
 */
export function SelectionMenu({ root, topOffset, onDefine, onAnnotate }: SelectionMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ type: string; down: boolean }>({ type: 'mouse', down: false });
  const dismissed = useRef(false);
  const topOffsetRef = useRef(topOffset);
  useEffect(() => {
    topOffsetRef.current = topOffset;
  });

  useEffect(() => {
    const update = () => {
      const element = root.current;
      const range = element ? textSelection(element) : undefined;
      // Mouse selections are still being made while the button is down.
      if (
        !element ||
        !range ||
        dismissed.current ||
        (pointer.current.down && pointer.current.type === 'mouse')
      ) {
        setMenu(null);
        return;
      }
      const positions = rangePositions(element, range);
      const place = placement(range, pointer.current.type === 'touch', topOffsetRef.current());
      setMenu(positions && place ? { range: positions, ...place } : null);
    };
    const onSelectionChange = () => {
      dismissed.current = false;
      update();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      pointer.current = { type: event.pointerType, down: true };
    };
    const onPointerUp = () => {
      pointer.current = { ...pointer.current, down: false };
      update();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (event.key === 'Escape') {
        dismissed.current = true;
        setMenu(null);
      } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        // Keyboard users reach the menu from their selection (SELX-011).
        event.preventDefault();
        menuRef.current.querySelector<HTMLElement>('button')?.focus();
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [root]);

  if (!menu) {
    return null;
  }

  const act = (action: (range: SelectedRange) => void) => {
    const { range } = menu;
    window.getSelection()?.removeAllRanges();
    setMenu(null);
    action(range);
  };

  return (
    <Paper
      ref={menuRef}
      role="toolbar"
      aria-label="Selection"
      elevation={6}
      // Keep the selection when a button is pressed.
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          window.getSelection()?.collapseToEnd();
        }
      }}
      sx={{
        position: 'fixed',
        top: menu.top,
        left: menu.left,
        zIndex: (theme) => theme.zIndex.modal - 1,
        display: 'flex',
        gap: 0.5,
        p: 0.5,
      }}
    >
      <Button
        size="small"
        startIcon={<MenuBook />}
        onClick={() => {
          act(onDefine);
        }}
      >
        Add definition
      </Button>
      <Button
        size="small"
        startIcon={<Bookmark />}
        onClick={() => {
          act(onAnnotate);
        }}
      >
        Add annotation
      </Button>
    </Paper>
  );
}
