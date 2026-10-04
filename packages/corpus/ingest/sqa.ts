/**
 * Converts a play from a Shakespeare Quartos Archive transcription into a version document
 * (CRP-020 – CRP-033).
 *
 * The Quartos Archive transcribes one physical copy page by page, in TEI: speeches (`<sp>`) of
 * verse lines (`<l>`) and prose paragraphs (`<p>`) whose printed line breaks are recorded
 * (`<lb>`, with a soft hyphen before a break inside a word); stage directions (`<stage>`);
 * running heads, catchwords and signatures (`<fw>`); damage to the copy (`<gap>`); and a later
 * hand's additions (`<add>`: page numbers, and text supplied where the page was cropped). Its
 * act and scene divisions are the transcribers', not the printer's, so they are editorial.
 * There are no node IDs, so IDs come from the committed ID map (CRP-024).
 */
import type { Element, Node } from '@xmldom/xmldom';

import type {
  Act,
  Block,
  LineNode,
  Mark,
  MarkType,
  PageBreak,
  Scene,
  StageDirectionNode,
  TextNode,
} from '../src/schema.ts';
import type { IdMap } from './lib/ids.ts';
import { TextBuilder } from './lib/text-builder.ts';
import { attr, childNodes, children, isElement, parseXml } from './lib/xml.ts';

export interface SqaPlayOptions {
  ids: IdMap;
}

export interface ConvertedSqaVersion {
  divisions: Act[];
  pageBreaks: PageBreak[];
  /** Printed signatures that disagree with the page count, i.e. misprints ("O2 signed G2"). */
  misprintedSignatures: string[];
}

/** Placeholders kept in a node's text while it is built, so their offsets follow every edit. */
const LINE_BREAK = '';
const PAGE_BREAK = '';
const INLINE_STAGE = '';

/** Signature letters: a printer's alphabet has no J, U or W. */
const SIGNATURE_LETTERS = 'ABCDEFGHIKLMNOPQRSTVXYZ';
/** A quarto's gatherings are four leaves, eight pages. */
const PAGES_PER_GATHERING = 8;

/**
 * Labels every page break by its signature (`sig. B2r`), counted from the signatures printed at
 * the foot of the first leaves of each gathering. Each printed signature is checked against the
 * count; those that disagree are reported, to catch a page missing from the transcription (or
 * confirm a known misprint).
 */
function signatureLabels(body: Element): { labels: Map<Element, string>; misprinted: string[] } {
  const pages: Element[] = [];
  const misprinted: string[] = [];
  let offset: number | undefined;
  const visit = (node: Node) => {
    for (const child of children(node)) {
      if (child.localName === 'pb') {
        pages.push(child);
      } else if (child.localName === 'fw' && attr(child, 'type') === 'signature') {
        // Without the later hand's page numbers, written beside some signatures.
        const printed = childNodes(child)
          .filter((part) => !(isElement(part) && part.localName === 'add'))
          .map((part) => part.textContent ?? '')
          .join('')
          .trim();
        const match = /^([A-Z])(\d*)\.?$/.exec(printed);
        const gathering = match ? SIGNATURE_LETTERS.indexOf(match[1] ?? '') : -1;
        if (match && gathering >= 0 && pages.length > 0) {
          const leaf = Number(match[2] === '' ? '1' : match[2]);
          const expected = gathering * PAGES_PER_GATHERING + (leaf - 1) * 2 - (pages.length - 1);
          offset ??= expected;
          if (offset !== expected) {
            misprinted.push(`${match[0]} on page ${String(pages.length)}`);
          }
        }
      } else {
        visit(child);
      }
    }
  };
  visit(body);
  if (offset === undefined) {
    throw new Error('No printed signatures to count pages from');
  }
  const start = offset;
  const labels = new Map(
    pages.map((pb, i) => {
      const page = i + start;
      const within = page % PAGES_PER_GATHERING;
      const letter = SIGNATURE_LETTERS[Math.floor(page / PAGES_PER_GATHERING)] ?? '?';
      const leaf = Math.floor(within / 2) + 1;
      return [pb, `sig. ${letter}${String(leaf)}${within % 2 === 0 ? 'r' : 'v'}`] as const;
    }),
  );
  return { labels, misprinted };
}

interface Context {
  ids: IdMap;
  pageLabels: Map<Element, string>;
  sceneId: string;
  ordinal: Record<'line' | 'sd', number>;
  pageBreaks: PageBreak[];
  /** A page break seen since the last node was created, to attach to the next one. */
  pendingPage: string | undefined;
}

/** One printed line (or a whole stage direction or heading) with its placeholders resolved. */
interface Segment {
  text: string;
  marks: Mark[];
  pages: { label: string; offset: number }[];
  stages: { element: Element; offset: number }[];
}

/** Builds text from mixed Quartos Archive markup. */
class Content {
  readonly builder = new TextBuilder();
  readonly #context: Context;
  /** Whether printed line breaks divide the text into separate lines (prose). */
  readonly #lines: boolean;
  readonly #pages: string[] = [];
  readonly #stages: Element[] = [];

  constructor(context: Context, options: { lines?: boolean; marks?: MarkType[] } = {}) {
    this.#context = context;
    this.#lines = options.lines ?? false;
    for (const mark of options.marks ?? []) {
      this.builder.open(mark);
    }
  }

  visit(node: Node): void {
    this.visitAll(childNodes(node));
  }

  visitAll(nodes: Node[]): void {
    for (const child of nodes) {
      if (!isElement(child)) {
        this.builder.append(child.nodeValue ?? '');
        continue;
      }
      switch (child.localName) {
        case 'hi':
          if ((attr(child, 'rend') ?? '').includes('italic')) {
            this.builder.open('italic');
            this.visit(child);
            this.builder.close('italic');
          } else {
            this.visit(child);
          }
          break;
        case 'name':
          // The transcription runs a name on from italic text without the printed space
          // ("Wittenberg</hi><name>Horatio").
          if (
            child.previousSibling?.nodeType === 1 &&
            /\p{L}$/u.test(this.builder.text) &&
            /^\p{L}/u.test(child.textContent ?? '')
          ) {
            this.builder.append(' ');
          }
          this.visit(child);
          break;
        case 'c':
        case 'del': // struck through by a later reader; the printed text stands
          this.visit(child);
          break;
        case 'abbr':
          // The printed abbreviation (`thē`); its expansion is the transcriber's.
          this.visitAll(
            childNodes(child).filter((part) => !(isElement(part) && part.localName === 'expan')),
          );
          break;
        case 'subst':
          // A later reader's correction: keep what was printed.
          this.visitAll(children(child).filter((part) => part.localName !== 'add'));
          break;
        case 'add':
          // Text lost where the page was cropped, supplied by a later hand, is kept; the
          // later hand's page numbers are not part of the text.
          if (attr(child, 'type') !== 'bibliographic') {
            this.visit(child);
          }
          break;
        case 'gap': {
          // Each missing character is a "•"; a missing word, one "•" (CRP-032).
          const extent = Math.max(1, Number(attr(child, 'extent') ?? '1') || 1);
          const missing =
            attr(child, 'unit') === 'words'
              ? Array.from({ length: extent }, () => '•').join(' ')
              : '•'.repeat(extent);
          this.builder.appendMarked(missing, 'gap');
          break;
        }
        case 'lb':
          this.builder.append(
            this.#lines && attr(child, 'rend') !== 'turnunder' ? LINE_BREAK : ' ',
          );
          break;
        case 'pb':
          this.#pages.push(this.#context.pageLabels.get(child) ?? '');
          this.builder.append(PAGE_BREAK);
          break;
        case 'stage':
          this.#stages.push(child);
          this.builder.append(INLINE_STAGE);
          break;
        case 'fw':
        case 'milestone':
        case 'note':
          break;
        default:
          throw new Error(`Unexpected <${child.localName ?? '?'}> in ${this.#context.sceneId}`);
      }
    }
  }

  /**
   * The finished text, divided at printed line breaks. A word broken across lines is joined
   * and kept whole on the first line (CRP-030).
   */
  segments(): Segment[] {
    const { text, marks = [] } = this.builder.build();
    const deleted = new Array<boolean>(text.length).fill(false);
    const breaks = new Set<number>();
    for (const match of text.matchAll(/­[\s]*/g)) {
      const end = match.index + match[0].length;
      for (let i = match.index; i < end; i += 1) {
        deleted[i] = text[i] !== PAGE_BREAK;
      }
      if (match[0].includes(LINE_BREAK)) {
        // The line break moves to the end of the joined word.
        const rest = text.slice(end).search(/[\s]/);
        if (rest >= 0) {
          breaks.add(end + rest);
          deleted[end + rest] = true;
        }
      }
    }
    text.split('').forEach((char, i) => {
      if (char === LINE_BREAK && !deleted[i]) {
        breaks.add(i);
        deleted[i] = true;
      }
    });

    const segments: Segment[] = [];
    // Where each kept character of `text` landed: [segment, offset].
    const position = new Map<number, [number, number]>();
    let current: Segment = { text: '', marks: [], pages: [], stages: [] };
    let pages = 0;
    let stages = 0;
    const flush = () => {
      current.text = current.text.trimEnd();
      segments.push(current);
      current = { text: '', marks: [], pages: [], stages: [] };
    };
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i] ?? '';
      if (breaks.has(i)) {
        flush();
      }
      if (char === PAGE_BREAK) {
        current.pages.push({ label: this.#pages[pages] ?? '', offset: current.text.length });
        pages += 1;
      } else if (char === INLINE_STAGE) {
        current.stages.push({
          element: this.#stages[stages] as Element,
          offset: current.text.trimEnd().length,
        });
        stages += 1;
      } else if (deleted[i] || (char === ' ' && /^$| $/.test(current.text))) {
        continue;
      } else {
        position.set(i, [segments.length, current.text.length]);
        current.text += char;
      }
    }
    flush();

    for (const mark of marks) {
      const covered = new Map<number, [number, number]>();
      for (let i = mark.start; i < mark.end; i += 1) {
        const at = position.get(i);
        if (at) {
          const [segment, offset] = at;
          const range = covered.get(segment);
          covered.set(segment, range ? [range[0], offset + 1] : [offset, offset + 1]);
        }
      }
      for (const [segment, [start, end]] of covered) {
        const target = segments[segment] as Segment;
        const clamped = Math.min(end, target.text.length);
        if (clamped > start) {
          target.marks.push({ start, end: clamped, type: mark.type });
        }
      }
    }
    for (const segment of segments) {
      for (const page of segment.pages) {
        page.offset = Math.min(page.offset, segment.text.length);
      }
    }
    return segments;
  }
}

function nextId(context: Context, kind: 'line' | 'sd', text: string): string {
  const ordinal = context.ordinal[kind];
  context.ordinal[kind] += 1;
  return context.ids.get(`${context.sceneId}/${kind}/${String(ordinal)}`, text);
}

function placePages(context: Context, nodeId: string, segment: Segment): void {
  if (context.pendingPage) {
    context.pageBreaks.push({ nodeId, offset: 0, label: context.pendingPage });
    context.pendingPage = undefined;
  }
  for (const { label, offset } of segment.pages) {
    context.pageBreaks.push({ nodeId, offset, label });
  }
}

/** A page break at the very end of a node belongs to the next one. */
function carryTrailingPage(context: Context, segment: Segment): Segment {
  const last = segment.pages.at(-1);
  if (last?.offset === segment.text.length && segment.text !== '') {
    context.pendingPage = last.label;
    return { ...segment, pages: segment.pages.slice(0, -1) };
  }
  return segment;
}

const built = (segment: Segment) =>
  segment.marks.length > 0 ? { text: segment.text, marks: segment.marks } : { text: segment.text };

function stageNode(element: Element, context: Context): StageDirectionNode {
  const content = new Content(context);
  content.visit(element);
  const segment = carryTrailingPage(context, mergeSegments(content.segments()));
  const id = nextId(context, 'sd', segment.text);
  placePages(context, id, segment);
  const sdType = attr(element, 'type');
  return { id, kind: 'sd', ...built(segment), ...(sdType ? { sdType } : {}) };
}

/** Stage directions and headings are single nodes even where they were printed on two lines. */
function mergeSegments(segments: Segment[]): Segment {
  return segments.reduce((merged, next) => {
    const gap = merged.text !== '' && next.text !== '' ? 1 : 0;
    const shift = merged.text.length + gap;
    return {
      text: merged.text + (gap ? ' ' : '') + next.text,
      marks: [
        ...merged.marks,
        ...next.marks.map((m) => ({ ...m, start: m.start + shift, end: m.end + shift })),
      ],
      pages: [...merged.pages, ...next.pages.map((p) => ({ ...p, offset: p.offset + shift }))],
      stages: [...merged.stages, ...next.stages.map((s) => ({ ...s, offset: s.offset + shift }))],
    };
  });
}

/** A verse line, or each printed line of a prose paragraph, with stage directions inside. */
function lineNodes(
  element: Element,
  form: LineNode['form'],
  context: Context,
  marks: MarkType[],
): TextNode[] {
  const content = new Content(context, { lines: form === 'prose', marks });
  content.visit(element);
  return content.segments().flatMap((raw): TextNode[] => {
    if (raw.text === '') {
      if (raw.pages[0]) {
        context.pendingPage = raw.pages[0].label;
      }
      return raw.stages.map(({ element: sd }) => stageNode(sd, context));
    }
    const leading = raw.stages
      .filter(({ offset }) => offset === 0)
      .map(({ element: sd }) => stageNode(sd, context));
    const segment = carryTrailingPage(context, raw);
    // Allocate the line's ID before its inner stage directions so IDs follow reading order.
    const id = nextId(context, 'line', segment.text);
    placePages(context, id, segment);
    const trailing = segment.stages
      .filter(({ offset }) => offset > 0)
      .map(({ element: sd, offset }) => {
        const node = stageNode(sd, context);
        return offset < segment.text.length ? { ...node, inlineAt: offset } : node;
      });
    return [...leading, { id, kind: 'line', ...built(segment), form }, ...trailing];
  });
}

function speechNodes(element: Element, context: Context, marks: MarkType[] = []): TextNode[] {
  const nodes: TextNode[] = [];
  for (const child of children(element)) {
    switch (child.localName) {
      case 'speaker':
      case 'fw':
      case 'milestone':
        break;
      case 'l':
        nodes.push(...lineNodes(child, 'verse', context, marks));
        break;
      case 'p':
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
      case 'stage':
        nodes.push(stageNode(child, context));
        break;
      case 'pb':
        context.pendingPage = context.pageLabels.get(child) ?? context.pendingPage;
        break;
      default:
        throw new Error(`Unexpected <${child.localName ?? '?'}> in a speech in ${context.sceneId}`);
    }
  }
  return nodes;
}

function speakerLabel(speaker: Element, context: Context): string {
  const content = new Content(context);
  content.visit(speaker);
  return mergeSegments(content.segments()).text;
}

function sceneBlocks(div: Element, context: Context): Block[] {
  const blocks: Block[] = [];
  const pushNodes = (nodes: TextNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'sd') {
        blocks.push({ type: 'sd', node });
      } else {
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
      case 'head': // the play's title, printed above the first scene
      case 'fw':
      case 'milestone':
      case 'trailer': // "FINIS."
        break;
      case 'sp': {
        const speaker = children(child, 'speaker')[0];
        const label = speaker ? speakerLabel(speaker, context) : '';
        const nodes = speechNodes(child, context);
        if (nodes.some((node) => node.kind === 'line')) {
          blocks.push({ type: 'speech', speakers: [], label, nodes });
        } else {
          pushNodes(nodes);
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
      case 'pb':
        context.pendingPage = context.pageLabels.get(child) ?? context.pendingPage;
        break;
      default:
        throw new Error(`Unexpected <${child.localName ?? '?'}> in ${context.sceneId}`);
    }
  }
  return blocks;
}

export function convertSqaPlay(xml: string, { ids }: SqaPlayOptions): ConvertedSqaVersion {
  const text = children(parseXml(xml), 'text')[0];
  const body = text ? children(text, 'body')[0] : undefined;
  if (!body) {
    throw new Error('No <text><body>');
  }
  const signatures = signatureLabels(body);
  const context: Context = {
    ids,
    pageLabels: signatures.labels,
    sceneId: '',
    ordinal: { line: 0, sd: 0 },
    pageBreaks: [],
    pendingPage: undefined,
  };
  const divisions: Act[] = [];
  for (const div1 of children(body, 'div1')) {
    if (attr(div1, 'type') !== 'act') {
      continue;
    }
    const act: Act = { n: Number(attr(div1, 'n')), editorial: true, scenes: [] };
    for (const div2 of children(div1, 'div2')) {
      const n = Number(attr(div2, 'n'));
      context.sceneId = `${String(act.n)}.${String(n)}`;
      context.ordinal = { line: 0, sd: 0 };
      const scene: Scene = {
        id: context.sceneId,
        kind: 'scene',
        n,
        editorial: true,
        blocks: sceneBlocks(div2, context),
      };
      act.scenes.push(scene);
    }
    divisions.push(act);
  }
  return {
    divisions,
    pageBreaks: context.pageBreaks,
    misprintedSignatures: signatures.misprinted,
  };
}
