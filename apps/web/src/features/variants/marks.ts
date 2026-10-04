/**
 * Where a play's curated variants (CRP-060) show in one of its versions (VAR-001, VAR-002): the
 * spans of that version's readings, and the places where it lacks a passage other printings
 * have, found through alignment (CRP-050).
 */
import type {
  AlignmentFile,
  TextAnchor,
  Variant,
  VersionIndex,
  VersionInfo,
} from '@shakespeer/corpus';

import { decorationsFor } from '@/features/reader/anchors';
import type { Decoration } from '@/features/reader/segments';

/** Decoration IDs for variant readings. */
export const VARIANT_PREFIX = 'v:';

/** A place where this version lacks a passage (VAR-002). */
export interface AbsentMark {
  variantIds: string[];
  label: string;
}

export interface VariantMarks {
  /** Variants whose reading in this version starts in the node: its margin mark (VAR-001). */
  starts: ReadonlyMap<string, readonly string[]>;
  /** Reading spans per node, for the outline. */
  decorations: ReadonlyMap<string, readonly Decoration[]>;
  /** Missing passages, after the node they follow. */
  absent: ReadonlyMap<string, readonly AbsentMark[]>;
  variant(id: string): Variant | undefined;
}

const EMPTY: VariantMarks = {
  starts: new Map(),
  decorations: new Map(),
  absent: new Map(),
  variant: () => undefined,
};

const listNames = (names: readonly string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;

/**
 * Where a passage this version lacks, starting at a modern node, belongs: within a line this
 * version has (words missing from it), or after the node before it (whole lines missing).
 */
function placeOf(
  alignment: AlignmentFile,
  modernNodeId: string,
): { within: string } | { after: string } | undefined {
  const at = alignment.entries.findIndex((entry) => entry.modern.includes(modernNodeId));
  const own = alignment.entries[at]?.orig[0];
  if (own) {
    return { within: own };
  }
  for (let i = at - 1; i >= 0; i -= 1) {
    const orig = alignment.entries[i]?.orig;
    if (orig && orig.length > 0) {
      return { after: orig.at(-1) ?? '' };
    }
  }
  return undefined;
}

export function variantMarks(
  index: VersionIndex,
  variants: readonly Variant[],
  version: VersionInfo,
  versions: readonly VersionInfo[],
  alignment: AlignmentFile | undefined,
  modernVersionId: string,
): VariantMarks {
  if (variants.length === 0) {
    return EMPTY;
  }
  const starts = new Map<string, string[]>();
  const decorations = new Map<string, Decoration[]>();
  const absent = new Map<string, AbsentMark[]>();
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const info = new Map(versions.map((v) => [v.id, v]));

  for (const variant of variants) {
    const reading = variant.readings.find((r) => r.versionId === version.id);
    if (!reading) {
      continue;
    }
    if (reading.start && reading.end) {
      if (index.indexOf(reading.start.nodeId) === undefined) {
        continue;
      }
      const span = { start: reading.start, end: reading.end } as TextAnchor;
      const id = VARIANT_PREFIX + variant.id;
      for (const [nodeId, decoration] of decorationsFor(index, span, id)) {
        decorations.set(nodeId, [...(decorations.get(nodeId) ?? []), decoration]);
      }
      starts.set(reading.start.nodeId, [...(starts.get(reading.start.nodeId) ?? []), variant.id]);
      continue;
    }
    // Lacking the passage: marked only where other early printings have it (VAR-002).
    const present = variant.readings.filter(
      (r) => r.start && info.get(r.versionId)?.kind === 'original',
    );
    const modern = variant.readings.find((r) => r.versionId === modernVersionId)?.start;
    const [first] = present;
    if (!first || !modern || !alignment) {
      continue;
    }
    const place = placeOf(alignment, modern.nodeId);
    if (!place) {
      continue;
    }
    if ('within' in place) {
      // Words missing from a line this version has: marked on that line.
      starts.set(place.within, [...(starts.get(place.within) ?? []), variant.id]);
      continue;
    }
    const { after } = place;
    const names = present.map((r) => info.get(r.versionId)?.shortName ?? r.versionId);
    const lines = first.text.split('\n').length;
    const label = `${listNames(names)} ${names.length === 1 ? 'has' : 'have'} ${String(lines)} ${lines === 1 ? 'line' : 'lines'} here`;
    const marks = absent.get(after) ?? [];
    const same = marks.find((mark) => mark.label === label);
    if (same) {
      same.variantIds.push(variant.id);
    } else {
      marks.push({ variantIds: [variant.id], label });
    }
    absent.set(after, marks);
  }
  return { starts, decorations, absent, variant: (id) => byId.get(id) };
}
