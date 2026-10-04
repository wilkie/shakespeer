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

import type { DisplayCut, InsertedNode } from '@/features/cuts/display';
import { ANNOTATION_PREFIX, TERM_PREFIX, type NoteIndex } from '@/features/notes/noteIndex';
import { highlightVar } from '@/features/notes/palette';

import { segmentText, type Segment } from './segments';
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
  /** The current cut, if not Full play (CUT-040 – CUT-046). */
  cut?: CutView | undefined;
}

/** How the current cut shows (CUT-040 – CUT-043). */
export interface CutView {
  display: DisplayCut;
  /** Markers the reader has opened, by key (CUT-040). */
  revealed: ReadonlySet<string>;
  /** Show cut text everywhere (CUT-041). */
  showCutText: boolean;
  editing: boolean;
}

/** Decoration IDs for text a cut hides. */
const CUT_PREFIX = 'x:';

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

/** One run of text with uniform marks and notes. */
function SegmentView({
  node,
  segment,
  context,
}: {
  node: TextNode;
  segment: Segment;
  context: BlockContext;
}) {
  const { notes, revealTerms } = context;
  const classes = segment.marks.map((mark) => MARK_CLASSES[mark]);
  const content = segment.marks.includes('sup') ? <sup>{segment.text}</sup> : segment.text;
  const ids = segment.ids.filter((id) => !id.startsWith(CUT_PREFIX));
  if (ids.length === 0) {
    return classes.length > 0 ? <span className={classes.join(' ')}>{content}</span> : content;
  }
  const terms = ids
    .filter((id) => id.startsWith(TERM_PREFIX))
    .map((id) => id.slice(TERM_PREFIX.length));
  const annotations = ids
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
}

/** The reader's own or imported notes, not sourced glossary terms (CUT-044). */
function isReaderNote(decorationId: string, context: BlockContext): boolean {
  if (decorationId.startsWith(ANNOTATION_PREFIX)) {
    return true;
  }
  return (
    decorationId.startsWith(TERM_PREFIX) &&
    (context.notes.term(decorationId.slice(TERM_PREFIX.length))?.definitions.length ?? 0) > 0
  );
}

const revealedBy = (context: BlockContext, key: string) =>
  context.forceReveal ||
  (context.cut !== undefined && (context.cut.showCutText || context.cut.revealed.has(key)));

/**
 * Text a cut hides within a node (CUT-040, CUT-042): kept in the page but not displayed, so
 * character offsets stay exact (ANC-020); a marker stands in for it, or the new wording of a
 * replacement. Revealed, it is struck through.
 */
function CutRun({
  node,
  opId,
  segments,
  context,
}: {
  node: TextNode;
  opId: string;
  segments: readonly Segment[];
  context: BlockContext;
}) {
  const cut = context.cut;
  const start = segments[0]?.start ?? 0;
  const type = cut?.display.hidden.get(node.id)?.find((r) => r.opId === opId)?.type ?? 'hide';
  const key = `range:${node.id}:${String(start)}`;
  const revealed = revealedBy(context, key);
  const hasNotes = segments.some((segment) => segment.ids.some((id) => isReaderNote(id, context)));
  const replacement =
    type === 'replace'
      ? cut?.display.replacements.get(node.id)?.find((r) => r.op.id === opId && r.offset === start)
      : undefined;
  const editing = cut?.editing ?? false;
  return (
    <>
      {type === 'hide' && !context.forceReveal && (
        <span
          className="cut-marker cut-inline"
          role="button"
          tabIndex={0}
          aria-expanded={revealed}
          aria-label={revealed ? 'Hide cut text' : 'Show cut text'}
          data-cut-reveal={key}
          data-cut-ops={opId}
        >
          {hasNotes && <span className="cut-dot" />}
        </span>
      )}
      <span
        className={revealed ? 'cut-text' : 'cut-hidden'}
        {...(editing && revealed ? { 'data-cut-ops': opId } : {})}
      >
        {segments.map((segment) => (
          <SegmentView key={segment.start} node={node} segment={segment} context={context} />
        ))}
      </span>
      {replacement && (
        <span
          className="cut-repl"
          role="button"
          tabIndex={0}
          aria-label={`${replacement.op.text} (replaces “${replacement.op.anchor.quote.exact}”)`}
          data-text={replacement.op.text}
          data-original={replacement.op.anchor.quote.exact}
          data-cut-ops={opId}
          data-cut-kind="replace"
        />
      )}
    </>
  );
}

function NodeText({ node, context }: { node: TextNode; context: BlockContext }) {
  const { notes, cut } = context;
  const hidden = cut?.display.hidden.get(node.id) ?? [];
  const decorations = [
    ...(notes.byNode.get(node.id) ?? []),
    ...hidden.map((range) => ({
      start: range.start,
      end: range.end,
      id: CUT_PREFIX + range.opId,
    })),
  ];
  const segments = segmentText(node.text, node.marks, decorations);
  // Consecutive segments a cut hides form one run.
  const runs: { opId: string | undefined; segments: Segment[] }[] = [];
  for (const segment of segments) {
    const opId = segment.ids.find((id) => id.startsWith(CUT_PREFIX))?.slice(CUT_PREFIX.length);
    const last = runs.at(-1);
    if (last?.opId === opId && last) {
      last.segments.push(segment);
    } else {
      runs.push({ opId, segments: [segment] });
    }
  }
  return (
    <span className="node" data-node-id={node.id}>
      {runs.map((run) =>
        run.opId === undefined ? (
          run.segments.map((segment) => (
            <SegmentView key={segment.start} node={node} segment={segment} context={context} />
          ))
        ) : (
          <CutRun
            key={run.segments[0]?.start}
            node={node}
            opId={run.opId}
            segments={run.segments}
            context={context}
          />
        ),
      )}
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
  cut: CutView | undefined;
  /** Inside revealed cut text: show everything, struck through, without markers. */
  forceReveal: boolean;
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
function plainBody(nodes: readonly TextNode[], context: BlockContext): ReactNode[] {
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

function nodesOf(block: Block): TextNode[] {
  return block.type === 'speech' ? block.nodes : [block.node];
}

const isHidden = (node: TextNode, context: BlockContext) =>
  !context.forceReveal && (context.cut?.display.hiddenNodes.has(node.id) ?? false);

/** "12 lines cut", "1 stage direction cut" (CUT-040). */
function cutLabel(nodes: readonly TextNode[]): string {
  const lines = nodes.filter((node) => node.kind === 'line').length;
  if (lines > 0) {
    return `${String(lines)} ${lines === 1 ? 'line' : 'lines'} cut`;
  }
  return `${String(nodes.length)} ${nodes.length === 1 ? 'stage direction' : 'stage directions'} cut`;
}

/**
 * A marker for whole nodes a cut hides (CUT-040), which reveals them in place; it shows a dot
 * when notes are attached to them (CUT-044). `data-hides` lets the reader find hidden nodes.
 */
function HiddenRun({
  revealKey,
  label,
  nodes,
  context,
  children,
}: {
  revealKey: string;
  label: string;
  nodes: readonly TextNode[];
  context: BlockContext;
  children: ReactNode;
}) {
  const ids = nodes.map((node) => node.id);
  const ops = [
    ...new Set(ids.flatMap((id) => context.cut?.display.hidden.get(id)?.map((r) => r.opId) ?? [])),
  ];
  const hasNotes = ids.some((id) =>
    (context.notes.byNode.get(id) ?? []).some((decoration) => isReaderNote(decoration.id, context)),
  );
  const revealed = revealedBy(context, revealKey);
  return (
    <>
      <div
        className="cut-marker cut-block"
        role="button"
        tabIndex={0}
        aria-expanded={revealed}
        data-cut-reveal={revealKey}
        data-cut-ops={ops.join(' ')}
        data-hides={ids.join(' ')}
      >
        <span>
          {label}
          {hasNotes && <span className="cut-dot" aria-label="has notes" />}
        </span>
      </div>
      {revealed && <div className="cut-revealed">{children}</div>}
    </>
  );
}

/** Text a cut adds (CUT-043). */
function AddedText({ node, context }: { node: InsertedNode; context: BlockContext }) {
  const editing = context.cut?.editing ?? false;
  return (
    <div
      className={`sd cut-added${node.narration ? ' narration' : ''}`}
      data-inserted-id={node.id}
      data-cut-ops={node.opId}
      data-cut-kind="insert"
      {...(editing ? { role: 'button', tabIndex: 0 } : {})}
    >
      <span className="cut-added-label">+ Added</span>
      {node.text}
    </div>
  );
}

function addedAfter(nodes: readonly TextNode[], context: BlockContext): ReactNode[] {
  if (context.forceReveal) {
    return []; // shown once, by whatever collapsed these nodes
  }
  return nodes.flatMap((node) =>
    (context.cut?.display.inserts.get(node.id) ?? []).map((added) => (
      <AddedText key={added.id} node={added} context={context} />
    )),
  );
}

/** A speech's body, with lines a cut hides collapsed and its added text (CUT-040, CUT-043). */
function speechBody(nodes: readonly TextNode[], context: BlockContext): ReactNode[] {
  const body: ReactNode[] = [];
  let shown: TextNode[] = [];
  let hidden: TextNode[] = [];
  const flushShown = () => {
    if (shown.length > 0) {
      body.push(...plainBody(shown, context));
      shown = [];
    }
  };
  const flushHidden = () => {
    const [first] = hidden;
    if (first) {
      const run = hidden;
      body.push(
        <HiddenRun
          key={`cut-${first.id}`}
          revealKey={`nodes:${first.id}`}
          label={cutLabel(run)}
          nodes={run}
          context={context}
        >
          {plainBody(run, { ...context, forceReveal: true })}
        </HiddenRun>,
      );
      hidden = [];
    }
  };
  for (const node of nodes) {
    if (isHidden(node, context)) {
      flushShown();
      hidden.push(node);
    } else {
      flushHidden();
      shown.push(node);
    }
    const added = addedAfter([node], context);
    if (added.length > 0) {
      flushShown();
      flushHidden();
      body.push(...added);
    }
  }
  flushShown();
  flushHidden();
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
  const editing = (context.cut?.editing ?? false) && !context.forceReveal;
  const first = block.nodes[0];
  const last = block.nodes.at(-1);
  return (
    <div className="speech">
      {(block.label !== '' || qualifier !== undefined || editing) && (
        <div className="speaker">
          {block.label}
          {editing && first && last && (
            <button
              type="button"
              className="cut-action"
              data-cut-action="cut-speech"
              data-from={first.id}
              data-to={last.id}
            >
              Cut speech
            </button>
          )}
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

/** A scene's blocks, with runs of blocks a cut hides entirely collapsed (CUT-040). */
function sceneBody(blocks: readonly Block[], context: BlockContext): ReactNode[] {
  const body: ReactNode[] = [];
  let hidden: Block[] = [];
  const flush = () => {
    const nodes = hidden.flatMap(nodesOf);
    const [first] = nodes;
    if (first) {
      const run = hidden;
      body.push(
        <HiddenRun
          key={`cut-${first.id}`}
          revealKey={`blocks:${first.id}`}
          label={cutLabel(nodes)}
          nodes={nodes}
          context={context}
        >
          {run.map((block) => (
            <BlockView
              key={nodesOf(block)[0]?.id}
              block={block}
              context={{ ...context, forceReveal: true }}
            />
          ))}
        </HiddenRun>,
        ...addedAfter(nodes, context),
      );
    }
    hidden = [];
  };
  blocks.forEach((block, i) => {
    const nodes = nodesOf(block);
    if (nodes.every((node) => isHidden(node, context))) {
      hidden.push(block);
      return;
    }
    flush();
    body.push(<BlockView key={nodes[0]?.id ?? i} block={block} context={context} />);
    // A speech adds its own (in speechBody).
    if (block.type === 'sd') {
      body.push(...addedAfter(nodes, context));
    }
  });
  flush();
  return body;
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
  const sceneCut = context.cut?.display.cutScenes.has(scene.id) ?? false;
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
      {context.cut?.editing && (
        <div className="cut-scene-actions">
          <button
            type="button"
            className="cut-action"
            data-cut-action={sceneCut ? 'restore-scene' : 'cut-scene'}
            data-scene={scene.id}
          >
            {sceneCut ? 'Restore scene' : 'Cut scene'}
          </button>
        </div>
      )}
      {sceneCut ? (
        <>
          <HiddenRun
            revealKey={`scene:${scene.id}`}
            label="Scene cut"
            nodes={scene.blocks.flatMap(nodesOf)}
            context={context}
          >
            {scene.blocks.map((block) => (
              <BlockView
                key={nodesOf(block)[0]?.id}
                block={block}
                context={{ ...context, forceReveal: true }}
              />
            ))}
          </HiddenRun>
          {addedAfter(scene.blocks.flatMap(nodesOf), context)}
        </>
      ) : (
        sceneBody(scene.blocks, context)
      )}
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
    // Cuts (CUT-040 – CUT-043).
    '& .cut-hidden': { display: 'none' },
    '& .cut-text, & .cut-revealed': {
      textDecoration: 'line-through',
      textDecorationColor: palette.text.secondary,
      opacity: 0.6,
    },
    '& .cut-marker': { cursor: 'pointer', userSelect: 'none', color: palette.text.secondary },
    '& .cut-inline::before': {
      content: '"⋯"',
      px: '0.2em',
      mx: '0.1em',
      borderRadius: '3px',
      backgroundColor: palette.action.hover,
    },
    '& .cut-block': {
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      my: 0.75,
      fontFamily: theme.typography.fontFamily,
      fontSize: '0.75rem',
      '&::before, &::after': {
        content: '""',
        flex: 1,
        borderTop: '1px dashed',
        borderColor: palette.divider,
      },
    },
    '& .cut-dot': {
      display: 'inline-block',
      width: '0.4em',
      height: '0.4em',
      ml: '0.3em',
      borderRadius: '50%',
      verticalAlign: 'middle',
      backgroundColor: palette.primary.main,
    },
    '& .cut-repl': {
      position: 'relative',
      outline: '1px dotted',
      outlineColor: palette.text.secondary,
      outlineOffset: '1px',
      borderRadius: '2px',
      '&::before': { content: 'attr(data-text)' },
      '&:hover::after, &:focus-visible::after': {
        content: '"Was: " attr(data-original)',
        position: 'absolute',
        left: 0,
        top: '100%',
        zIndex: 2,
        mt: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        backgroundColor: theme.palette.grey[800],
        color: theme.palette.common.white,
        fontFamily: theme.typography.fontFamily,
        fontSize: '0.8rem',
        fontStyle: 'normal',
        textIndent: 0,
        whiteSpace: 'pre',
        pointerEvents: 'none',
      },
    },
    '& .cut-added': { color: palette.text.primary },
    '& .cut-added.narration': { pl: '4em', fontStyle: 'normal' },
    '& .cut-added-label': {
      mr: 0.75,
      fontFamily: theme.typography.fontFamily,
      fontStyle: 'normal',
      fontSize: '0.7rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: palette.primary.main,
      userSelect: 'none',
    },
    '& .cut-action': {
      ml: 1,
      px: 1,
      py: 0.25,
      border: '1px solid',
      borderColor: palette.divider,
      borderRadius: 1,
      background: 'none',
      color: palette.primary.main,
      font: 'inherit',
      fontFamily: theme.typography.fontFamily,
      fontSize: '0.75rem',
      fontVariant: 'normal',
      letterSpacing: 'normal',
      cursor: 'pointer',
      '&:hover': { backgroundColor: palette.action.hover },
    },
    '& .cut-scene-actions': { mt: -1.5, mb: 1.5, '& .cut-action': { ml: 0 } },
    '& .cut-marker:focus-visible, & .cut-repl:focus-visible, & .cut-added:focus-visible': {
      outline: `2px solid ${palette.primary.main}`,
      outlineOffset: '1px',
    },
    '& .hl:focus-visible': { outline: `2px solid ${palette.primary.main}`, outlineOffset: '1px' },
    '& .term:focus-visible': { outline: `2px solid ${palette.primary.main}`, outlineOffset: '1px' },
  };
};

/** The whole version as one continuous document (RDR-020 – RDR-028). */
export function PlayText({ doc, notes, revealTerms, ref, footer, cut }: PlayTextProps) {
  const context: BlockContext = {
    notes,
    revealTerms,
    cut,
    forceReveal: false,
    ghosts: splitLineGhosts(doc),
  };
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
