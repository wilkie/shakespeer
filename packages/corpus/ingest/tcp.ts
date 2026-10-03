/**
 * Converts one play from an EEBO-TCP transcription into a version document (CRP-020 – CRP-033).
 *
 * TCP preserves original spelling and typography: long s (ſ), line-end hyphens
 * (`<g ref="char:EOLhyphen"/>`), illegible characters (`<gap>`), unreadable punctuation
 * (`<g ref="char:punc">▪</g>`), superscript abbreviations and italic (`<hi>`). Verse is in `<l>`;
 * prose paragraphs are `<p>` without recorded line breaks. TCP has no node IDs, so IDs come from
 * the committed ID map (CRP-024). Speakers and line numbers are filled in after alignment.
 */
import type { Element, Node } from '@xmldom/xmldom';

import type {
  Act,
  Block,
  LineNode,
  MarkType,
  PageBreak,
  Scene,
  SpeechBlock,
  StageDirectionNode,
  TextNode,
} from '../src/schema.ts';
import type { IdMap } from './lib/ids.ts';
import { TextBuilder } from './lib/text-builder.ts';
import { attr, childNodes, children, isElement, parseXml, plainText } from './lib/xml.ts';

export interface TcpPlayOptions {
  /** Matches the play's `<head>`, e.g. /TEMPEST/. */
  title: RegExp;
  ids: IdMap;
}

export interface ConvertedTcpVersion {
  divisions: Act[];
  pageBreaks: PageBreak[];
}

/** Display text for TCP glyph references (`<g ref="char:…">`). */
const GLYPHS: Partial<Record<string, string>> = {
  'char:EOLhyphen': '',
  'char:V': 'V',
};

function normalizeSpelling(text: string): string {
  return text.replaceAll('ſ', 's');
}

function headingText(element: Element): string {
  return normalizeSpelling(plainText(element));
}

const ACT_HEADING = /^act/i;
const SCENE_HEADING = /^sc(?:o?e|œ)na/i; // Scena, Scoena, Scœna

interface Context {
  ids: IdMap;
  sceneId: string;
  ordinal: Record<'line' | 'sd', number>;
  pageBreaks: PageBreak[];
  /** A page break seen since the last node was created, to attach to the next one. */
  pendingPage: string | undefined;
}

/** Builds one text node's content from mixed TCP markup. */
class NodeContent {
  readonly builder = new TextBuilder();
  readonly #context: Context;
  readonly #pages: string[] = [];
  readonly #pageOffsets: number[] = [];
  /** Stage directions found inside this node, with their offsets. */
  readonly inline: { element: Element; offset: number }[] = [];

  constructor(context: Context, marks: MarkType[] = []) {
    this.#context = context;
    for (const mark of marks) {
      this.builder.open(mark);
    }
  }

  visit(node: Node): void {
    for (const child of childNodes(node)) {
      if (!isElement(child)) {
        this.builder.append(normalizeSpelling(child.nodeValue ?? ''));
        continue;
      }
      switch (child.localName) {
        case 'g': {
          const ref = attr(child, 'ref') ?? '';
          if (ref === 'char:punc') {
            this.builder.appendMarked('•', 'gap');
          } else {
            this.builder.append(GLYPHS[ref] ?? normalizeSpelling(child.textContent ?? ''));
          }
          break;
        }
        case 'gap':
          this.builder.appendMarked('•', 'gap');
          break;
        case 'hi': {
          const mark: MarkType = attr(child, 'rend') === 'sup' ? 'sup' : 'italic';
          this.builder.open(mark);
          this.visit(child);
          this.builder.close(mark);
          break;
        }
        case 'stage':
          this.inline.push({ element: child, offset: this.builder.length });
          break;
        case 'pb':
          this.#pages.push(attr(child, 'n') ?? '');
          this.#pageOffsets.push(this.builder.length);
          break;
        case 'note':
        case 'desc':
          break;
        default:
          this.visit(child);
      }
    }
  }

  /** Records page breaks that fell inside this node, once its ID is known. */
  recordPages(nodeId: string): void {
    this.#pages.forEach((page, i) => {
      if (page) {
        this.#context.pageBreaks.push({
          nodeId,
          offset: this.#pageOffsets[i] ?? 0,
          label: `p. ${page}`,
        });
      }
    });
  }
}

function nextId(context: Context, kind: 'line' | 'sd', text: string): string {
  const ordinal = context.ordinal[kind];
  context.ordinal[kind] += 1;
  return context.ids.get(`${context.sceneId}/${kind}/${String(ordinal)}`, text);
}

function attachPendingPage(context: Context, nodeId: string): void {
  if (context.pendingPage) {
    context.pageBreaks.push({ nodeId, offset: 0, label: `p. ${context.pendingPage}` });
    context.pendingPage = undefined;
  }
}

function stageNode(element: Element, context: Context, sdType?: string): StageDirectionNode {
  const content = new NodeContent(context);
  content.visit(element);
  const built = content.builder.build();
  const id = nextId(context, 'sd', built.text);
  attachPendingPage(context, id);
  content.recordPages(id);
  return { id, kind: 'sd', ...built, ...(sdType ? { sdType } : {}) };
}

/** A verse line or prose paragraph, followed by any stage directions inside it. */
function lineNodes(
  element: Element,
  form: LineNode['form'],
  context: Context,
  marks: MarkType[],
): TextNode[] {
  const content = new NodeContent(context, marks);
  content.visit(element);
  const built = content.builder.build();
  const leading: TextNode[] = [];
  const trailing: TextNode[] = [];
  if (built.text === '') {
    return content.inline.map(({ element: sd }) => stageNode(sd, context));
  }
  // Allocate the line's ID before its inner stage directions so IDs follow reading order.
  const before = content.inline.filter(({ offset }) => offset === 0);
  for (const { element: sd } of before) {
    leading.push(stageNode(sd, context));
  }
  const id = nextId(context, 'line', built.text);
  attachPendingPage(context, id);
  content.recordPages(id);
  for (const { element: sd, offset } of content.inline.filter(({ offset }) => offset > 0)) {
    const node = stageNode(sd, context);
    trailing.push(offset < built.text.length ? { ...node, inlineAt: offset } : node);
  }
  return [...leading, { id, kind: 'line', ...built, form }, ...trailing];
}

function speechNodes(element: Element, context: Context, marks: MarkType[] = []): TextNode[] {
  const nodes: TextNode[] = [];
  for (const child of children(element)) {
    switch (child.localName) {
      case 'speaker':
        break;
      case 'l':
        nodes.push(...lineNodes(child, 'verse', context, marks));
        break;
      case 'p':
        nodes.push(...lineNodes(child, 'prose', context, marks));
        break;
      case 'q':
      case 'floatingText':
      case 'body':
        // A quoted passage or a letter read aloud: its lines are part of the speech.
        nodes.push(...speechNodes(child, context, marks));
        break;
      case 'opener':
      case 'closer':
      case 'salute':
      case 'signed':
      case 'dateline':
        // The parts of a letter around its body read as prose lines.
        nodes.push(...lineNodes(child, 'prose', context, marks));
        break;
      case 'lg':
        nodes.push(
          ...speechNodes(
            child,
            context,
            attr(child, 'type') === 'song' ? [...marks, 'song'] : marks,
          ),
        );
        break;
      case 'head':
        nodes.push(stageNode(child, context, 'label'));
        break;
      case 'stage':
        nodes.push(stageNode(child, context));
        break;
      case 'pb':
        context.pendingPage = attr(child, 'n') ?? context.pendingPage;
        break;
      default:
        throw new Error(`Unexpected <${child.localName ?? '?'}> in a speech in ${context.sceneId}`);
    }
  }
  return nodes;
}

function sceneBlocks(div: Element, context: Context): Block[] {
  const blocks: Block[] = [];
  const pushNodes = (nodes: TextNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'sd') {
        blocks.push({ type: 'sd', node });
      } else {
        // Verse or prose outside a speech (e.g. an epilogue without a speaker heading).
        const last = blocks.at(-1);
        if (last?.type === 'speech' && last.label === '') {
          last.nodes.push(node);
        } else {
          blocks.push({ type: 'speech', speakers: [], label: '', nodes: [node] });
        }
      }
    }
  };
  for (const child of children(div)) {
    switch (child.localName) {
      case 'head':
      case 'div':
        break;
      case 'sp': {
        const speaker = children(child, 'speaker')[0];
        const block: SpeechBlock = {
          type: 'speech',
          speakers: [],
          label: speaker ? headingText(speaker) : '',
          nodes: speechNodes(child, context),
        };
        if (block.nodes.length > 0) {
          blocks.push(block);
        }
        break;
      }
      case 'stage':
        blocks.push({ type: 'sd', node: stageNode(child, context) });
        break;
      case 'l':
        pushNodes(lineNodes(child, 'verse', context, []));
        break;
      case 'p':
        pushNodes(lineNodes(child, 'prose', context, []));
        break;
      case 'lg':
        pushNodes(speechNodes(child, context));
        break;
      case 'pb':
        context.pendingPage = attr(child, 'n') ?? context.pendingPage;
        break;
      default:
        throw new Error(`Unexpected <${child.localName ?? '?'}> in ${context.sceneId}`);
    }
  }
  return blocks;
}

function findPlay(root: Element, title: RegExp): Element {
  const body = children(root, 'text')[0]
    ? children(children(root, 'text')[0] as Element, 'body')[0]
    : undefined;
  const plays = body ? children(body, 'div').filter((div) => attr(div, 'type') === 'play') : [];
  // The title heads the play, or (Troilus, whose prologue was printed first) its first act.
  const play = plays.find((div) =>
    [...children(div, 'head'), ...children(div, 'div').flatMap((child) => children(child, 'head'))]
      .slice(0, 3)
      .some((head) => title.test(headingText(head))),
  );
  if (!play) {
    throw new Error(`No play matching ${String(title)}`);
  }
  return play;
}

/**
 * Classifies a TCP division by its printed heading, falling back to its `type`, because TCP
 * occasionally mislabels divisions (The Tempest's Act 3, Scene 1 is typed as an act).
 */
function divisionKind(div: Element): 'act' | 'scene' | 'epilogue' | 'prologue' | 'other' {
  const type = attr(div, 'type');
  if (type === 'epilogue' || type === 'prologue') {
    return type;
  }
  const head = children(div, 'head')[0];
  const heading = head ? headingText(head) : '';
  if (ACT_HEADING.test(heading)) {
    return 'act';
  }
  if (SCENE_HEADING.test(heading)) {
    return 'scene';
  }
  return type === 'act' || type === 'scene' ? type : 'other';
}

export function convertTcpPlay(xml: string, { title, ids }: TcpPlayOptions): ConvertedTcpVersion {
  const play = findPlay(parseXml(xml), title);
  const context: Context = {
    ids,
    sceneId: '',
    ordinal: { line: 0, sd: 0 },
    pageBreaks: [],
    pendingPage: undefined,
  };
  const divisions: Act[] = [];

  const makeScene = (
    div: Element,
    act: Act | undefined,
    kind: Scene['kind'],
    options: { heading?: boolean } = {},
  ): Scene => {
    // The printed scene number where the transcription records it, else the next in order.
    const counted = (act?.scenes.filter((s) => s.kind === 'scene').length ?? 0) + 1;
    const printed = Number(attr(div, 'n'));
    const n =
      kind === 'scene'
        ? div.localName === 'div' && attr(div, 'type') === 'scene' && printed >= counted
          ? printed
          : counted
        : null;
    const sceneId =
      kind === 'scene'
        ? `${String(act?.n)}.${String(n)}`
        : act?.n
          ? `${String(act.n)}.${kind}`
          : kind;
    context.sceneId = sceneId;
    context.ordinal = { line: 0, sd: 0 };
    const head = options.heading === false ? undefined : children(div, 'head')[0];
    return {
      id: sceneId,
      kind,
      n,
      editorial: false,
      ...(head ? { heading: headingText(head) } : {}),
      blocks: sceneBlocks(div, context),
    };
  };

  for (const div of children(play)) {
    if (div.localName === 'pb') {
      context.pendingPage = attr(div, 'n') ?? context.pendingPage;
      continue;
    }
    if (div.localName !== 'div') {
      continue;
    }
    const kind = divisionKind(div);
    const head = children(div, 'head')[0];
    if (kind === 'act') {
      const act: Act = {
        n: divisions.filter((a) => a.n !== null).length + 1,
        editorial: false,
        ...(head ? { heading: headingText(head) } : {}),
        scenes: [],
      };
      divisions.push(act);
      // Text printed under the act heading before its first scene heading (Hamlet's Act 2
      // in the Folio) is the act's first scene.
      if (
        children(div).some((child) =>
          ['sp', 'stage', 'l', 'p', 'lg'].includes(child.localName ?? ''),
        )
      ) {
        act.scenes.push(makeScene(div, act, 'scene', { heading: false }));
      }
      for (const child of children(div, 'div')) {
        const childKind = divisionKind(child);
        if (childKind === 'scene' || childKind === 'epilogue' || childKind === 'prologue') {
          act.scenes.push(makeScene(child, act, childKind));
        } else {
          throw new Error(`Unexpected division in act ${String(act.n)}: ${childKind}`);
        }
      }
    } else if (kind === 'scene') {
      // A scene mislabeled as an act sits at play level; it belongs to the preceding act.
      const act = divisions.at(-1);
      if (!act) {
        throw new Error('Scene before any act');
      }
      act.scenes.push(makeScene(div, act, 'scene'));
      for (const child of children(div, 'div')) {
        act.scenes.push(makeScene(child, act, 'scene'));
      }
    } else if (kind === 'epilogue' || kind === 'prologue') {
      divisions.push({ n: null, editorial: false, scenes: [makeScene(div, undefined, kind)] });
    }
    // Other divisions (dramatis personae, etc.) are front/back matter, omitted (CRP-020).
  }
  return { divisions, pageBreaks: context.pageBreaks };
}
