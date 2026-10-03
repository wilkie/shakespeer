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
import type { ReactNode, Ref } from 'react';

import { segmentText, type Decoration } from './segments';
import { sceneTitle } from './titles';

export interface PlayTextProps {
  doc: VersionDocument;
  /** Definition terms per text node (DEF-030). */
  decorations: ReadonlyMap<string, readonly Decoration[]>;
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

function NodeText({
  node,
  decorations,
  revealTerms,
}: {
  node: TextNode;
  decorations: readonly Decoration[] | undefined;
  revealTerms: boolean;
}) {
  const segments = segmentText(node.text, node.marks, decorations);
  return (
    <span className="node" data-node-id={node.id}>
      {segments.map((segment) => {
        const className = segment.marks.map((mark) => MARK_CLASSES[mark]).join(' ');
        const content = segment.marks.includes('sup') ? <sup>{segment.text}</sup> : segment.text;
        if (segment.ids.length === 0) {
          return className ? (
            <span key={segment.start} className={className}>
              {content}
            </span>
          ) : (
            content
          );
        }
        // Terms are activated by delegated handlers on the text root (see Reader).
        return (
          <span
            key={segment.start}
            className={`term ${className}`}
            data-terms={segment.ids.join(' ')}
            data-offset={segment.start}
            {...(revealTerms ? { role: 'button', tabIndex: 0 } : {})}
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
  decorations: PlayTextProps['decorations'];
  revealTerms: boolean;
  /** Text of earlier parts of each split verse line, for indentation (RDR-024). */
  ghosts: ReadonlyMap<string, string>;
}

function StageDirection({ node, context }: { node: StageDirectionNode; context: BlockContext }) {
  return (
    <div className={`sd${node.sdType === 'label' ? ' sd-label' : ''}`}>
      <NodeText
        node={node}
        decorations={context.decorations.get(node.id)}
        revealTerms={context.revealTerms}
      />
    </div>
  );
}

function Line({ node, context }: { node: LineNode; context: BlockContext }) {
  const label = lineNumberLabel(node);
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
      <NodeText
        node={node}
        decorations={context.decorations.get(node.id)}
        revealTerms={context.revealTerms}
      />
    </span>
  );
}

/** Groups a speech's nodes: verse lines and directions are blocks; prose lines flow together. */
function speechBody(nodes: readonly TextNode[], context: BlockContext): ReactNode[] {
  const body: ReactNode[] = [];
  let prose: LineNode[] = [];
  const flushProse = () => {
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
  };
  for (const node of nodes) {
    if (node.kind === 'line' && node.form === 'prose') {
      prose.push(node);
      continue;
    }
    flushProse();
    body.push(
      node.kind === 'line' ? (
        <div key={node.id} className="verse-row">
          <Line node={node} context={context} />
        </div>
      ) : (
        <StageDirection key={node.id} node={node} context={context} />
      ),
    );
  }
  flushProse();
  return body;
}

function BlockView({ block, context }: { block: Block; context: BlockContext }) {
  if (block.type === 'sd') {
    return <StageDirection node={block.node} context={context} />;
  }
  return (
    <div className="speech">
      {block.label && (
        <div className="speaker" aria-hidden="false">
          {block.label}
        </div>
      )}
      {speechBody(block.nodes, context)}
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

/** Text of preceding parts of split verse lines (RDR-024). */
function splitLineGhosts(doc: VersionDocument): Map<string, string> {
  const ghosts = new Map<string, string>();
  let chain = '';
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
            ghosts.set(node.id, chain);
            chain = `${chain} ${node.text}`;
          }
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
    '& .term:focus-visible': { outline: `2px solid ${palette.primary.main}`, outlineOffset: '1px' },
  };
};

/** The whole version as one continuous document (RDR-020 – RDR-028). */
export function PlayText({ doc, decorations, revealTerms, ref, footer }: PlayTextProps) {
  const context: BlockContext = { decorations, revealTerms, ghosts: splitLineGhosts(doc) };
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
