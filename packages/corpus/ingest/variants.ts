/**
 * Seeds variants from the Folger markup (CRP-061): every editorial emendation and every passage
 * the edition marks as coming from only one early printing becomes a variant, with the modern
 * reading and each original version's reading found through alignment. Curated notes are added
 * from `curation/<playId>/variants.json` (CRP-004).
 */
import type { AlignmentEntry, Variant, VariantReading, VersionDocument } from '../src/schema.ts';
import type { MarkedPassage, TokenSpan } from './folger.ts';
import { textNodes } from './lib/revision.ts';

export interface OriginalVersion {
  doc: VersionDocument;
  entries: AlignmentEntry[];
}

export interface SeedReport {
  seeded: number;
  /** Passages whose tokens are not in the text (e.g. in front matter). */
  skipped: number;
}

/** Nodes between two aligned nodes that still count as one reading. */
const GAP = 3;

function truncate(text: string, length: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Versions the edition says lack a passage: "Text from the Folio not found in the Second
 * Quarto" names the second quarto; an unqualified "Quarto" means the play's only one.
 */
export function versionsLacking(description: string, versionIds: readonly string[]): Set<string> {
  const named = /not found in the (?:(first|second) )?(quarto|folio)/i.exec(description);
  if (!named) {
    return new Set();
  }
  const [, ordinal, printing] = named;
  const prefix =
    printing?.toLowerCase() === 'folio'
      ? 'f1-'
      : ordinal?.toLowerCase() === 'second'
        ? 'q2-'
        : ordinal?.toLowerCase() === 'first'
          ? 'q1-'
          : 'q';
  return new Set(versionIds.filter((id) => id.startsWith(prefix)));
}

export function seedVariants(
  modern: VersionDocument,
  tokens: ReadonlyMap<string, TokenSpan>,
  passages: readonly MarkedPassage[],
  originals: readonly OriginalVersion[],
  notes: Readonly<Record<string, string>> = {},
): { variants: Variant[]; report: SeedReport } {
  const nodes = textNodes(modern);
  const order = new Map(nodes.map((node, i) => [node.id, i]));
  const report: SeedReport = { seeded: 0, skipped: 0 };
  const variants: Variant[] = [];

  for (const passage of passages) {
    const spans = passage.tokens
      .map((token) => tokens.get(token))
      .filter((span): span is TokenSpan => span !== undefined && order.has(span.nodeId));
    const first = spans[0];
    const last = spans.at(-1);
    if (!first || !last) {
      report.skipped += 1;
      continue;
    }
    const from = order.get(first.nodeId) ?? 0;
    const to = order.get(last.nodeId) ?? 0;
    const covered = nodes.slice(from, to + 1);
    const text = covered
      .map((node, i) =>
        node.text.slice(i === 0 ? first.start : 0, i === covered.length - 1 ? last.end : undefined),
      )
      .join('\n');
    if (text.trim() === '') {
      report.skipped += 1;
      continue;
    }

    const readings: VariantReading[] = [
      {
        versionId: modern.versionId,
        start: { nodeId: first.nodeId, offset: first.start },
        end: { nodeId: last.nodeId, offset: last.end },
        text,
      },
    ];
    const coveredIds = new Set(covered.map((node) => node.id));
    // The edition's own word on which printings lack the passage outranks the aligner, which
    // may pair a missing line with a neighbour that shares a few words.
    const lacking = versionsLacking(
      passage.description,
      originals.map(({ doc }) => doc.versionId),
    );
    for (const { doc, entries } of originals) {
      if (lacking.has(doc.versionId)) {
        readings.push({ versionId: doc.versionId, text: '' });
        continue;
      }
      const origIds = new Set(
        entries.filter((e) => e.modern.some((m) => coveredIds.has(m))).flatMap((e) => e.orig),
      );
      // The reading is the first run of aligned nodes (allowing small gaps): a reordered
      // version (Q1 Hamlet) may scatter matches far apart.
      const all = textNodes(doc);
      const matched = all.flatMap((node, i) => (origIds.has(node.id) ? [i] : []));
      let runEnd = matched[0] ?? -1;
      for (const i of matched.slice(1)) {
        if (i - runEnd > GAP) {
          break;
        }
        runEnd = i;
      }
      const origNodes = matched.length > 0 ? all.slice(matched[0], runEnd + 1) : [];
      const firstNode = origNodes[0];
      const lastNode = origNodes.at(-1);
      readings.push(
        firstNode && lastNode
          ? {
              versionId: doc.versionId,
              start: { nodeId: firstNode.id, offset: 0 },
              end: { nodeId: lastNode.id, offset: lastNode.text.length },
              text: origNodes.map((node) => node.text).join('\n'),
            }
          : { versionId: doc.versionId, text: '' },
      );
    }

    const lineNumber = covered.flatMap((node) =>
      node.kind === 'line' && node.n ? [node.n] : [],
    )[0];
    const id = `folger-${passage.id}`;
    variants.push({
      id,
      title: `${capitalize(passage.description)}: “${truncate(text, 60)}”${lineNumber ? ` (${lineNumber})` : ''}`,
      note: notes[id] ?? '',
      sourceIds: ['folger'],
      readings,
    });
    report.seeded += 1;
  }
  return { variants, report };
}
