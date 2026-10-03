import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/material/styles';
import type {
  Block,
  LineNode,
  MarkType,
  Scene,
  StageDirectionNode,
  TextNode,
  VersionDocument,
} from '@shakespeer/corpus';
import type { CSSProperties, ReactNode, Ref } from 'react';

import { ANNOTATION_PREFIX, TERM_PREFIX, type NoteIndex } from '@/features/notes/noteIndex';
import { highlightVar } from '@/features/notes/palette';

import { segmentText } from './segments';
import { sceneTitle } from './titles';

export interface PlayTextProps {
  doc: VersionDocument;
  /** Terms and annotations attached to the text (DEF-030, ANN-020). */
  notes: NoteIndex;
  /** Whether all definition underlines are revealed (DEF-034, DEF-035). */
  revealTerms: boolean;
  ref?: Ref<HTMLDivElement>;
  /** Rendered after the text (ATR-002). */
  footer?: ReactNode;
}

const MARK_CLASSES: Record<MarkType, string> = {
  italic: 'm-italic',
  sup: 'm-sup',
  song: 'm-song',
  foreign: 'm-italic',
  gap: 'm-gap',
};

/** Background for a run covered by annotations: one color, or equal stripes (ANN-021). */
function highlightStyle(colors: readonly string[]): CSSProperties | undefined {
  if (colors.length === 0) {
    return undefined;
  }
  if (colors.length === 1) {
    return { backgroundColor: colors[0] };
  }
  const step = 100 / colors.length;
  const stops = colors.map(
    (color, i) => `${color} ${String(i * step)}% ${String((i + 1) * step)}%`,
  );
  return { backgroundImage: `linear-gradient(to bottom, ${stops.join(', ')})` };
}

function NodeText({ node, context }: { node: TextNode; context: BlockContext }) {
  const { notes, revealTerms } = context;
  const segments = segmentText(node.text, node.marks, notes.byNode.get(node.id));
  return (
    <span className="node" data-node-id={node.id}>
      {segments.map((segment) => {
        const classes = segment.marks.map((mark) => MARK_CLASSES[mark]);
        const content = segment.marks.includes('sup') ? <sup>{segment.text}</sup> : segment.text;
        if (segment.ids.length === 0) {
          return classes.length > 0 ? (
            <span key={segment.start} className={classes.join(' ')}>
              {content}
            </span>
          ) : (
            content
          );
        }
        const terms = segment.ids
          .filter((id) => id.startsWith(TERM_PREFIX))
          .map((id) => id.slice(TERM_PREFIX.length));
        const annotations = segment.ids
          .filter((id) => id.startsWith(ANNOTATION_PREFIX))
          .flatMap((id) => notes.annotation(id.slice(ANNOTATION_PREFIX.length)) ?? []);
        if (terms.length > 0) {
          classes.push('term');
        }
        if (annotations.length > 0) {
          classes.push('hl');
          // A marker ends highlights that carry notes, links or citations (ANN-022).
          const ending = annotations.some(
            (a) =>
              a.anchor.end.nodeId === node.id &&
              a.anchor.end.offset === segment.end &&
              (a.notes.trim() !== '' || a.links.length > 0 || a.citations.length > 0),
          );
          if (ending) {
            classes.push('hl-end');
          }
        }
        const interactive = annotations.length > 0 || revealTerms;
        // Notes are activated by delegated handlers on the text root (see ReaderPage).
        return (
          <span
            key={segment.start}
            className={classes.join(' ')}
            style={highlightStyle(annotations.map((a) => highlightVar(a.color)))}
            data-offset={segment.start}
            {...(terms.length > 0 ? { 'data-terms': terms.join(' ') } : {})}
            {...(annotations.length > 0
              ? { 'data-annotations': annotations.map((a) => a.id).join(' ') }
              : {})}
            {...(interactive ? { role: 'button', tabIndex: 0 } : {})}
          >
            {content}
          </span>
        );
      })}
    </span>
  );
}

/** The last digits of a line number, for showing every fifth one (RDR-026). */
function lineNumberLabel(line: LineNode): string | undefined {
  const last = /(\d+)$/.exec(line.n ?? '')?.[1];
  return last !== undefined && Number(last) % 5 === 0 ? last : undefined;
}

interface BlockContext {
  notes: NoteIndex;
  revealTerms: boolean;
  /** Text of earlier parts of each split verse line, for indentation (RDR-024). */
  ghosts: ReadonlyMap<string, string>;
}

function StageDirection({ node, context }: { node: StageDirectionNode; context: BlockContext }) {
  return (
    <div className={`sd${node.sdType === 'label' ? ' sd-label' : ''}`}>
      <NodeText node={node} context={context} />
    </div>
  );
}

function Line({
  node,
  context,
  showNumber,
}: {
  node: LineNode;
  context: BlockContext;
  showNumber?: boolean;
}) {
  // Numbered unless told otherwise.
  const label = showNumber === false ? undefined : lineNumberLabel(node);
  const ghost = context.ghosts.get(node.id);
  return (
    <span className={`line ${node.form}`}>
      {label && (
        <span className="ln" aria-hidden="true">
          {label}
        </span>
      )}
      {ghost && (
        <span className="ghost" aria-hidden="true">
          {ghost}
        </span>
      )}
      <NodeText node={node} context={context} />
    </span>
  );
}

/**
 * Whether `node` continues `previous` on the same line: the next part of a verse line. Within one
 * speech that is a long line the printer turned over, shown joined (RDR-024).
 */
function continuesLine(previous: TextNode | undefined, node: TextNode): boolean {
  return (
    previous?.kind === 'line' &&
    node.kind === 'line' &&
    previous.form === 'verse' &&
    node.form === 'verse' &&
    (previous.part === 'initial' || previous.part === 'medial') &&
    (node.part === 'medial' || node.part === 'final')
  );
}

/** A verse row: one line, or a turned-over line's parts joined. */
function VerseRow({ lines, context }: { lines: readonly LineNode[]; context: BlockContext }) {
  // One number per row; with several parts, the first part that has one.
  const numbered = lines.find((line) => lineNumberLabel(line) !== undefined);
  return (
    <div className="verse-row">
      {lines.map((line, i) => (
        <span key={line.id}>
          {i > 0 && ' '}
          <Line node={line} context={context} showNumber={line === numbered} />
        </span>
      ))}
    </div>
  );
}

/** Groups a speech's nodes: verse rows and directions are blocks; prose lines flow together. */
function speechBody(nodes: readonly TextNode[], context: BlockContext): ReactNode[] {
  const body: ReactNode[] = [];
  let prose: LineNode[] = [];
  let verse: LineNode[] = [];
  const flush = () => {
    if (prose.length > 0) {
      const lines = prose;
      body.push(
        <p key={lines[0]?.id} className="prose-run">
          {lines.map((line, i) => (
            <span key={line.id}>
              {i > 0 && ' '}
              <Line node={line} context={context} />
            </span>
          ))}
        </p>,
      );
      prose = [];
    }
    if (verse.length > 0) {
      body.push(<VerseRow key={verse[0]?.id} lines={verse} context={context} />);
      verse = [];
    }
  };
  for (const node of nodes) {
    if (node.kind === 'line' && node.form === 'prose') {
      if (verse.length > 0) {
        flush();
      }
      prose.push(node);
    } else if (node.kind === 'line') {
      if (!continuesLine(verse.at(-1), node)) {
        flush();
      }
      verse.push(node);
    } else {
      flush();
      body.push(<StageDirection key={node.id} node={node} context={context} />);
    }
  }
  flush();
  return body;
}

/** A direction printed after the speaker's name: ", within", ", aside to Sebastian" (RDR-022). */
function headingQualifier(nodes: readonly TextNode[]): StageDirectionNode | undefined {
  const first = nodes[0];
  return first?.kind === 'sd' && /^[,;:]/.test(first.text) ? first : undefined;
}

function BlockView({ block, context }: { block: Block; context: BlockContext }) {
  if (block.type === 'sd') {
    return <StageDirection node={block.node} context={context} />;
  }
  const qualifier = headingQualifier(block.nodes);
  return (
    <div className="speech">
      {(block.label || qualifier) && (
        <div className="speaker">
          {block.label}
          {qualifier && (
            <span className="speaker-sd">
              <NodeText node={qualifier} context={context} />
            </span>
          )}
        </div>
      )}
      {speechBody(qualifier ? block.nodes.slice(1) : block.nodes, context)}
    </div>
  );
}

function SceneView({
  scene,
  actN,
  context,
}: {
  scene: Scene;
  actN: number | null;
  context: BlockContext;
}) {
  const nodeCount = scene.blocks.reduce(
    (n, b) => n + (b.type === 'speech' ? b.nodes.length : 1),
    0,
  );
  return (
    <section
      className="scene"
      data-scene-id={scene.id}
      aria-label={sceneTitle(scene, actN)}
      // Unrendered scenes reserve an estimated height until they are laid out (RDR-027).
      style={{ containIntrinsicSize: `auto ${String(Math.max(200, nodeCount * 30))}px` }}
    >
      <h2
        className={`scene-heading${scene.editorial ? ' editorial' : ''}`}
        id={`scene-${scene.id}`}
      >
        {sceneTitle(scene, actN)}
        {scene.heading && <span className="printed-heading">{scene.heading}</span>}
      </h2>
      {scene.blocks.map((block, i) => (
        <BlockView
          key={block.type === 'sd' ? block.node.id : (block.nodes[0]?.id ?? i)}
          block={block}
          context={context}
        />
      ))}
    </section>
  );
}

/**
 * Text of the preceding parts of split verse lines, for indenting each part where the previous
 * one ended (RDR-024). Parts within one speech are shown joined instead, so need no indent.
 */
function splitLineGhosts(doc: VersionDocument): Map<string, string> {
  const ghosts = new Map<string, string>();
  let chain = '';
  let previous: TextNode | undefined;
  let previousBlock: Block | undefined;
  for (const act of doc.divisions) {
    for (const scene of act.scenes) {
      for (const block of scene.blocks) {
        for (const node of block.type === 'speech' ? block.nodes : [block.node]) {
          if (node.kind !== 'line' || !node.part) {
            continue;
          }
          if (node.part === 'initial') {
            chain = node.text;
          } else {
            if (!(continuesLine(previous, node) && previousBlock === block)) {
              ghosts.set(node.id, chain);
            }
            chain = `${chain} ${node.text}`;
          }
          previous = node;
          previousBlock = block;
        }
      }
    }
  }
  return ghosts;
}

const textStyles: SxProps<Theme> = (theme) => {
  // CSS variables are enabled in the theme, so colors follow the color scheme without re-rendering.
  const palette = (theme.vars ?? theme).palette;
  return {
    fontFamily: '"EB Garamond Variable", "EB Garamond", Georgia, serif',
    fontSize: '1.2rem',
    lineHeight: 1.6,
    maxWidth: '42rem',
    mx: 'auto',
    pl: { xs: '2.5rem', sm: '3.5rem' },
    pr: { xs: 1, sm: 2 },
    pb: 8,
    // content-visibility clips painting to the scene's box, so the box extends into the
    // left margin where line numbers sit.
    '& .scene': {
      contentVisibility: 'auto',
      ml: { xs: '-2.5rem', sm: '-3.5rem' },
      pl: { xs: '2.5rem', sm: '3.5rem' },
    },
    '& .scene-heading': {
      fontFamily: 'inherit',
      fontSize: '1.5rem',
      fontWeight: 600,
      mt: 6,
      mb: 2,
      userSelect: 'none',
      scrollMarginTop: 'calc(var(--reader-top, 64px) + 8px)',
    },
    '& .scene-heading.editorial': { fontStyle: 'italic' },
    '& .printed-heading': {
      display: 'block',
      fontSize: '1rem',
      fontWeight: 400,
      fontStyle: 'italic',
      color: palette.text.secondary,
    },
    '& .speech': { my: 1.5 },
    '& .speaker-sd': {
      fontVariant: 'normal',
      fontStyle: 'italic',
      letterSpacing: 'normal',
      userSelect: 'text',
    },
    '& .speaker': {
      fontVariant: 'small-caps',
      letterSpacing: '0.04em',
      color: palette.text.secondary,
      userSelect: 'none',
    },
    // Line numbers are positioned against the row or paragraph (not the inline line), so they
    // keep their line's vertical position but sit in the margin.
    '& .verse-row': { position: 'relative', pl: '2em', textIndent: '-2em' },
    '& .prose-run': { position: 'relative', m: 0 },
    '& .node': { scrollMarginTop: 'calc(var(--reader-top, 64px) + 8px)' },
    '& .ln': {
      position: 'absolute',
      left: { xs: '-2.5rem', sm: '-3.25rem' },
      width: { xs: '2rem', sm: '2.5rem' },
      textAlign: 'right',
      textIndent: 0,
      fontFamily: theme.typography.fontFamily,
      fontSize: '0.75rem',
      lineHeight: '1.9rem',
      color: palette.text.disabled,
      userSelect: 'none',
    },
    '& .ghost': { visibility: 'hidden', userSelect: 'none' },
    '& .sd': {
      fontStyle: 'italic',
      color: palette.text.secondary,
      pl: '2em',
      my: 0.5,
    },
    '& .sd-label': { pl: '1em', fontVariant: 'small-caps', fontStyle: 'normal' },
    '& .m-italic, & .m-song': { fontStyle: 'italic' },
    '& .m-gap': { color: palette.text.disabled },
    '& .term': { textDecorationColor: palette.text.secondary, borderRadius: '2px' },
    '@media (hover: hover)': {
      '& .term:hover': {
        textDecoration: 'underline dotted',
        textUnderlineOffset: '0.2em',
        cursor: 'pointer',
      },
    },
    '&.reveal-terms .term': {
      textDecoration: 'underline dotted',
      textUnderlineOffset: '0.2em',
      cursor: 'pointer',
    },
    '& .hl': { borderRadius: '2px', cursor: 'pointer', boxDecorationBreak: 'clone' },
    '& .hl-end::after': {
      content: '"\\25C6"',
      fontSize: '0.55em',
      verticalAlign: 'super',
      marginLeft: '1px',
      color: palette.text.secondary,
      userSelect: 'none',
    },
    '@media (forced-colors: active)': {
      '& .hl': { outline: '1px solid CanvasText', background: 'none' },
    },
    '& .hl:focus-visible': { outline: `2px solid ${palette.primary.main}`, outlineOffset: '1px' },
    '& .term:focus-visible': { outline: `2px solid ${palette.primary.main}`, outlineOffset: '1px' },
  };
};

/** The whole version as one continuous document (RDR-020 – RDR-028). */
export function PlayText({ doc, notes, revealTerms, ref, footer }: PlayTextProps) {
  const context: BlockContext = { notes, revealTerms, ghosts: splitLineGhosts(doc) };
  return (
    <Box ref={ref} className={revealTerms ? 'reveal-terms' : undefined} sx={textStyles}>
      {doc.divisions.map((act) =>
        act.scenes.map((scene) => (
          <SceneView key={scene.id} scene={scene} actN={act.n} context={context} />
        )),
      )}
      {footer}
    </Box>
  );
}
