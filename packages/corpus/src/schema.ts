/**
 * Schemas for every corpus file (specs/data/corpus.md). They are the single source for the
 * TypeScript types, for validating generated data, and for the published JSON Schemas in
 * `packages/corpus/schema/`.
 *
 * This module must only import `zod`: ingest scripts load it directly under Node.
 */
import { z } from 'zod';

const id = z.string().min(1);

// ---------------------------------------------------------------------------------------------
// Sources (CRP-080)

export const SourceSchema = z.object({
  id,
  name: z.string(),
  shortName: z.string(),
  description: z.string(),
  url: z.url(),
  license: z.object({
    name: z.string(),
    url: z.url(),
    commercialUse: z.boolean(),
  }),
  attribution: z.string(),
});
export type Source = z.infer<typeof SourceSchema>;

export const SourcesFileSchema = z.object({
  schemaVersion: z.literal(1),
  sources: z.array(SourceSchema),
});
export type SourcesFile = z.infer<typeof SourcesFileSchema>;

// ---------------------------------------------------------------------------------------------
// Play index (CRP-010)

export const GenreSchema = z.enum(['comedy', 'tragedy', 'history', 'romance', 'problem']);
export type Genre = z.infer<typeof GenreSchema>;

export const VersionKindSchema = z.enum(['modern', 'original']);
export type VersionKind = z.infer<typeof VersionKindSchema>;

export const VersionInfoSchema = z.object({
  id,
  name: z.string(),
  shortName: z.string(),
  kind: VersionKindSchema,
  printed: z.int().optional(),
  sourceIds: z.array(id).min(1),
});
export type VersionInfo = z.infer<typeof VersionInfoSchema>;

export const PlayInfoSchema = z.object({
  id,
  title: z.string(),
  shortTitle: z.string(),
  genre: GenreSchema,
  composed: z.object({ from: z.int(), to: z.int() }),
  modernVersionId: id,
  versions: z.array(VersionInfoSchema).min(1),
});
export type PlayInfo = z.infer<typeof PlayInfoSchema>;

export const PlayIndexSchema = z.object({
  schemaVersion: z.literal(1),
  plays: z.array(PlayInfoSchema),
});
export type PlayIndex = z.infer<typeof PlayIndexSchema>;

// ---------------------------------------------------------------------------------------------
// Version documents (CRP-020 – CRP-033)

export const MarkTypeSchema = z.enum(['italic', 'sup', 'song', 'foreign', 'gap']);
export type MarkType = z.infer<typeof MarkTypeSchema>;

/** Inline presentation over a node's `text`, in UTF-16 code units (CRP-023). */
export const MarkSchema = z.object({
  start: z.int().nonnegative(),
  end: z.int().positive(),
  type: MarkTypeSchema,
});
export type Mark = z.infer<typeof MarkSchema>;

const textNodeBase = {
  id,
  text: z.string().min(1),
  marks: z.array(MarkSchema).optional(),
};

export const LineNodeSchema = z.object({
  ...textNodeBase,
  kind: z.literal('line'),
  form: z.enum(['verse', 'prose']),
  /** Position within a verse line shared between speakers (RDR-024). */
  part: z.enum(['initial', 'medial', 'final']).optional(),
  /** Display line number, e.g. "3.1.56" (CRP-040, CRP-041). */
  n: z.string().optional(),
});
export type LineNode = z.infer<typeof LineNodeSchema>;

export const StageDirectionNodeSchema = z.object({
  ...textNodeBase,
  kind: z.literal('sd'),
  /** The source's classification: entrance, exit, business, label, … */
  sdType: z.string().optional(),
  /** Offset in the preceding line where this direction interrupts it (CRP-022). */
  inlineAt: z.int().positive().optional(),
});
export type StageDirectionNode = z.infer<typeof StageDirectionNodeSchema>;

export const TextNodeSchema = z.discriminatedUnion('kind', [
  LineNodeSchema,
  StageDirectionNodeSchema,
]);
export type TextNode = z.infer<typeof TextNodeSchema>;

export const SpeechBlockSchema = z.object({
  type: z.literal('speech'),
  speakers: z.array(id),
  /** The speaker name as printed. */
  label: z.string(),
  nodes: z.array(TextNodeSchema).min(1),
});
export type SpeechBlock = z.infer<typeof SpeechBlockSchema>;

export const StageBlockSchema = z.object({
  type: z.literal('sd'),
  node: StageDirectionNodeSchema,
});
export type StageBlock = z.infer<typeof StageBlockSchema>;

export const BlockSchema = z.discriminatedUnion('type', [SpeechBlockSchema, StageBlockSchema]);
export type Block = z.infer<typeof BlockSchema>;

export const SceneKindSchema = z.enum(['scene', 'prologue', 'epilogue', 'induction']);
export type SceneKind = z.infer<typeof SceneKindSchema>;

export const SceneSchema = z.object({
  /** Stable within the version: "1.2", or "epilogue", "5.epilogue", … */
  id,
  kind: SceneKindSchema,
  n: z.int().positive().nullable(),
  /** Division supplied by alignment rather than printed (CRP-031). */
  editorial: z.boolean(),
  heading: z.string().optional(),
  blocks: z.array(BlockSchema),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ActSchema = z.object({
  n: z.int().positive().nullable(),
  editorial: z.boolean(),
  heading: z.string().optional(),
  scenes: z.array(SceneSchema).min(1),
});
export type Act = z.infer<typeof ActSchema>;

export const CharacterSchema = z.object({
  id,
  name: z.string(),
  /** For original versions: the corresponding modern character (CRP-033). */
  modernId: id.optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const PageBreakSchema = z.object({
  nodeId: id,
  offset: z.int().nonnegative(),
  label: z.string(),
});
export type PageBreak = z.infer<typeof PageBreakSchema>;

export const VersionDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  playId: id,
  versionId: id,
  revision: z.string().regex(/^sha256:[0-9a-f]{16}$/),
  characters: z.array(CharacterSchema),
  divisions: z.array(ActSchema).min(1),
  pageBreaks: z.array(PageBreakSchema).optional(),
});
export type VersionDocument = z.infer<typeof VersionDocumentSchema>;

// ---------------------------------------------------------------------------------------------
// Alignment (CRP-050 – CRP-052)

export const AlignmentRelationSchema = z.enum([
  'same',
  'variant',
  'orig-only',
  'modern-only',
  'moved',
]);
export type AlignmentRelation = z.infer<typeof AlignmentRelationSchema>;

export const AlignmentEntrySchema = z.object({
  orig: z.array(id),
  modern: z.array(id),
  relation: AlignmentRelationSchema,
  status: z.enum(['auto', 'reviewed']),
});
export type AlignmentEntry = z.infer<typeof AlignmentEntrySchema>;

export const AlignmentFileSchema = z.object({
  schemaVersion: z.literal(1),
  playId: id,
  versionId: id,
  modernVersionId: id,
  /** Revisions of both versions the alignment was computed against. */
  revisions: z.object({ orig: z.string(), modern: z.string() }),
  entries: z.array(AlignmentEntrySchema),
});
export type AlignmentFile = z.infer<typeof AlignmentFileSchema>;
