/**
 * Converts a Folger Shakespeare TEI file into a version document (CRP-020 – CRP-025, CRP-040).
 *
 * Folger encodes every word (`w`), space (`c`) and punctuation mark (`pc`), starts each line
 * with an FTLN `milestone` (whose ID becomes the line's permanent ID), and marks split verse
 * lines with `prev`/`next`. Stage directions carry their own IDs.
 */
import type { Element, Node } from '@xmldom/xmldom';

import type {
  Act,
  Block,
  Character,
  LineNode,
  MarkType,
  Scene,
  SceneKind,
  SpeechBlock,
  StageDirectionNode,
  TextNode,
} from '../src/schema.ts';
import { TextBuilder } from './lib/text-builder.ts';
import {
  attr,
  childNodes,
  children,
  descendants,
  first,
  isElement,
  parseXml,
  plainText,
} from './lib/xml.ts';

/** Where a Folger word, space or punctuation token ended up in our text (CRP-061). */
export interface TokenSpan {
  nodeId: string;
  start: number;
  end: number;
}

/** A passage the edition marks: an emendation, or text from only one early printing. */
export interface MarkedPassage {
  /** The Folger pointer's ID, e.g. "ptr-0001". */
  id: string;
  /** The edition's own description of the mark, e.g. "editorial emendation". */
  description: string;
  /** "emend", "texta" or "textb". */
  kind: string;
  /** Token IDs, in order. */
  tokens: string[];
}

export interface ConvertedVersion {
  characters: Character[];
  divisions: Act[];
  tokens: Map<string, TokenSpan>;
  passages: MarkedPassage[];
}

/** Token positions collected while converting (one conversion at a time). */
let tokenSink: Map<string, TokenSpan> | undefined;

function recordToken(element: Element, nodeId: string, start: number, end: number): void {
  const id = attr(element, 'xml:id');
  if (id && tokenSink) {
    tokenSink.set(id, { nodeId, start, end });
  }
}

/** Folger person IDs look like `Prospero_Tmp`; ours drop the play suffix: `prospero`. */
function characterId(folgerId: string): string {
  return folgerId
    .replace(/^#/, '')
    .replace(/_[A-Za-z0-9]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Members of groups have no name of their own: `SPIRITS.Juno_Tmp` becomes "Spirits Juno". */
function nameFromId(folgerId: string): string {
  return folgerId
    .replace(/_[A-Za-z0-9]+$/, '')
    .split('.')
    .filter((segment) => segment !== '0')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

const SKIPPED = new Set(['lb', 'pb', 'fw', 'anchor', 'ptr', 'app', 'note']);
const MARKS: Partial<Record<string, MarkType>> = { foreign: 'foreign' };

function readCharacters(root: Element): Character[] {
  const characters = new Map<string, Character>();
  for (const name of ['person', 'personGrp']) {
    for (const person of descendants(root, name)) {
      const rawId = attr(person, 'xml:id');
      if (!rawId) {
        continue;
      }
      const nameElement = first(person, 'name') ?? first(person, 'persName');
      const id = characterId(rawId);
      characters.set(id, { id, name: nameElement ? plainText(nameElement) : nameFromId(rawId) });
    }
  }
  return [...characters.values()];
}

/** Appends a word-level element's text (w, c, pc and their inline children) to a builder. */
function appendInline(node: Node, builder: TextBuilder): void {
  for (const child of childNodes(node)) {
    if (!isElement(child)) {
      builder.append(child.nodeValue ?? '');
    } else if (child.localName === 'gap') {
      builder.appendMarked('•', 'gap');
    } else if (child.localName === 'hi') {
      builder.open('italic');
      appendInline(child, builder);
      builder.close('italic');
    } else {
      appendInline(child, builder);
    }
  }
}

/** A stage direction, or undefined if it is empty in the current edition (older printings only). */
function stageNode(stage: Element): StageDirectionNode | undefined {
  const builder = new TextBuilder();
  const stageId = attr(stage, 'xml:id') ?? '';
  const visit = (node: Element) => {
    for (const child of children(node)) {
      if (['w', 'c', 'pc'].includes(child.localName ?? '')) {
        const start = builder.length;
        appendInline(child, builder);
        recordToken(child, stageId, start, builder.length);
      } else if (child.localName === 'lb') {
        // Within a stage direction a line break separates words.
        builder.append(' ');
      } else if (!SKIPPED.has(child.localName ?? '')) {
        visit(child);
      }
    }
  };
  visit(stage);
  const id = attr(stage, 'xml:id');
  if (!id) {
    throw new Error('Stage direction without xml:id');
  }
  const sdType = stage.localName === 'label' ? 'label' : attr(stage, 'type');
  const built = builder.build();
  if (built.text === '') {
    return undefined;
  }
  return {
    id,
    kind: 'sd',
    ...built,
    ...(sdType ? { sdType } : {}),
  };
}

/** Walks a speech's content, splitting it into lines at FTLN milestones. */
class SpeechWalker {
  readonly nodes: TextNode[] = [];
  #line: { node: Omit<LineNode, 'text' | 'marks'>; builder: TextBuilder } | undefined;
  #pending: StageDirectionNode[] = [];
  readonly #activeMarks: MarkType[] = [];
  #quoteDepth = 0;

  walk(element: Element): void {
    for (const child of children(element)) {
      this.#visit(child);
    }
    this.#finishLine();
  }

  #visit(element: Element): void {
    const name = element.localName ?? '';
    if (SKIPPED.has(name)) {
      return;
    }
    if (name === 'milestone') {
      // Some milestones record an older printing's lineation (edRef="#print #adobe"); the
      // current edition's are unmarked or include #lemma.
      const edRef = attr(element, 'edRef');
      if (attr(element, 'unit') === 'ftln' && (!edRef || edRef.includes('#lemma'))) {
        this.#startLine(element);
      }
      return;
    }
    if (name === 'stage' || name === 'label') {
      const node = stageNode(element);
      if (node) {
        this.#stage(node);
      }
      return;
    }
    if (['w', 'c', 'pc'].includes(name)) {
      if (!this.#line) {
        throw new Error(`Text outside a line near ${attr(element, 'xml:id') ?? name}`);
      }
      if (name === 'w' && this.#line.node.n === undefined) {
        const n = attr(element, 'n');
        if (n) {
          this.#line.node.n = n;
        }
      }
      const start = this.#line.builder.length;
      appendInline(element, this.#line.builder);
      recordToken(element, this.#line.node.id, start, this.#line.builder.length);
      return;
    }
    // Folger leaves quotation marks to the renderer: <q> and <title rend="quotes">.
    const quoted = name === 'q' || (name === 'title' && attr(element, 'rend') === 'quotes');
    if (quoted) {
      this.#line?.builder.append(this.#quoteDepth % 2 === 0 ? '“' : '‘');
      this.#quoteDepth += 1;
    }
    const mark =
      name === 'seg' && attr(element, 'type') === 'song'
        ? 'song'
        : name === 'hi' && attr(element, 'rend') === 'italic'
          ? 'italic'
          : MARKS[name];
    if (mark) {
      this.#activeMarks.push(mark);
      this.#line?.builder.open(mark);
    }
    for (const child of children(element)) {
      this.#visit(child);
    }
    if (mark) {
      this.#activeMarks.pop();
      this.#line?.builder.close(mark);
    }
    if (quoted) {
      this.#quoteDepth -= 1;
      this.#line?.builder.append(this.#quoteDepth % 2 === 0 ? '”' : '’');
    }
  }

  #startLine(milestone: Element): void {
    this.#finishLine();
    const id = attr(milestone, 'xml:id');
    if (!id) {
      throw new Error('FTLN milestone without xml:id');
    }
    const prev = attr(milestone, 'prev');
    const next = attr(milestone, 'next');
    const part = prev && next ? 'medial' : next ? 'initial' : prev ? 'final' : undefined;
    const n = attr(milestone, 'n');
    const builder = new TextBuilder();
    for (const mark of this.#activeMarks) {
      builder.open(mark);
    }
    this.#line = {
      node: {
        id,
        kind: 'line',
        form: attr(milestone, 'ana') === '#prose' ? 'prose' : 'verse',
        ...(part ? { part } : {}),
        ...(n ? { n } : {}),
      },
      builder,
    };
  }

  #stage(node: StageDirectionNode): void {
    if (this.#line && !this.#line.builder.isEmpty) {
      // Placed after the line; `inlineAt` is kept only if the line continues afterwards.
      this.#pending.push({ ...node, inlineAt: this.#line.builder.length });
    } else {
      this.nodes.push(node);
    }
  }

  #finishLine(): void {
    if (!this.#line) {
      return;
    }
    const { node, builder } = this.#line;
    this.#line = undefined;
    const built = builder.build();
    if (built.text === '') {
      throw new Error(`Empty line ${node.id}`);
    }
    // Build the node in schema field order for stable, readable output.
    const { id, kind, form, part, n } = node;
    this.nodes.push({
      id,
      kind,
      ...built,
      form,
      ...(part ? { part } : {}),
      ...(n ? { n } : {}),
    });
    for (const sd of this.#pending) {
      const { inlineAt, ...rest } = sd;
      this.nodes.push(inlineAt !== undefined && inlineAt < built.text.length ? sd : rest);
    }
    this.#pending = [];
  }
}

function speech(sp: Element): SpeechBlock {
  const who = (attr(sp, 'who') ?? '').split(/\s+/).filter(Boolean);
  const speaker = children(sp, 'speaker')[0];
  const walker = new SpeechWalker();
  for (const child of children(sp)) {
    if (child.localName === 'ab') {
      walker.walk(child);
    } else if (child.localName === 'stage') {
      const node = stageNode(child);
      if (node) {
        walker.nodes.push(node);
      }
    }
  }
  return {
    type: 'speech',
    speakers: who.map(characterId),
    label: speaker ? plainText(speaker) : '',
    nodes: walker.nodes,
  };
}

function sceneKind(type: string | undefined): SceneKind {
  switch (type) {
    case 'scene':
    case 'prologue':
    case 'epilogue':
    case 'induction':
      return type;
    default:
      throw new Error(`Unknown division type ${type ?? '(none)'}`);
  }
}

function scene(div: Element, actN: number | null): Scene {
  const kind = sceneKind(attr(div, 'type'));
  const n = kind === 'scene' ? Number(attr(div, 'n')) : null;
  const id =
    kind === 'scene' ? `${String(actN)}.${String(n)}` : actN ? `${String(actN)}.${kind}` : kind;
  const blocks: Block[] = [];
  for (const child of children(div)) {
    switch (child.localName) {
      case 'head':
        for (const stage of descendants(child, 'stage')) {
          const node = stageNode(stage);
          if (node) {
            blocks.push({ type: 'sd', node });
          }
        }
        break;
      case 'stage':
      case 'label': {
        const node = stageNode(child);
        if (node) {
          blocks.push({ type: 'sd', node });
        }
        break;
      }
      case 'sp':
        blocks.push(speech(child));
        break;
      case 'lb':
      case 'pb':
      case 'fw':
      case 'milestone':
        break;
      default:
        throw new Error(`Unexpected <${child.localName ?? '?'}> in scene ${id}`);
    }
  }
  return { id, kind, n, editorial: false, blocks };
}

/** The edition's marked passages (its emendation pointers) and what each kind means. */
function markedPassages(root: Element): MarkedPassage[] {
  const descriptions = new Map(
    descendants(root, 'interp').map((interp) => [
      attr(interp, 'xml:id') ?? '',
      plainText(interp).trim(),
    ]),
  );
  return descendants(root, 'ptr')
    .filter((ptr) => attr(ptr, 'type') === 'emendation')
    .map((ptr) => {
      const kind = (attr(ptr, 'ana') ?? '').replace(/^#/, '');
      return {
        id: attr(ptr, 'xml:id') ?? '',
        description: descriptions.get(kind) ?? kind,
        kind,
        tokens: (attr(ptr, 'target') ?? '')
          .split(/\s+/)
          .map((target) => target.replace(/^#/, ''))
          .filter(Boolean),
      };
    });
}

export function convertFolger(xml: string): ConvertedVersion {
  const root = parseXml(xml);
  const tokens = new Map<string, TokenSpan>();
  tokenSink = tokens;
  const body = first(root, 'body');
  if (!body) {
    throw new Error('TEI has no body');
  }
  const divisions: Act[] = [];
  for (const div1 of children(body, 'div1')) {
    if (attr(div1, 'type') === 'act') {
      const n = Number(attr(div1, 'n'));
      divisions.push({
        n,
        editorial: false,
        scenes: children(div1, 'div2').map((div2) => scene(div2, n)),
      });
    } else if (attr(div1, 'type') === 'preface') {
      // Front matter, such as the 1609 quarto's epistle in Troilus, is omitted (CRP-020).
      console.warn(`  omitting front matter: ${attr(div1, 'type') ?? ''}`);
    } else {
      divisions.push({ n: null, editorial: false, scenes: [scene(div1, null)] });
    }
  }
  tokenSink = undefined;
  return { characters: readCharacters(root), divisions, tokens, passages: markedPassages(root) };
}
