/** What the corpus contains and where each version comes from (CRP-010, CRP-080). */
import type { PlayInfo, Source } from '../src/schema.ts';

export const SOURCES: Source[] = [
  {
    id: 'folger',
    name: 'Folger Shakespeare',
    shortName: 'Folger',
    description:
      'Modern-spelling editions edited by Barbara A. Mowat and Paul Werstine, encoded in TEI by the Folger Shakespeare Library.',
    url: 'https://www.folger.edu/explore/shakespeares-works/',
    license: {
      name: 'CC BY-NC 3.0 Unported',
      url: 'https://creativecommons.org/licenses/by-nc/3.0/',
      commercialUse: false,
    },
    attribution:
      'Folger Shakespeare, edited by Barbara A. Mowat and Paul Werstine. Folger Shakespeare Library, https://shakespeare.folger.edu. Distributed under a Creative Commons Attribution-NonCommercial 3.0 Unported License.',
  },
  {
    id: 'eebo-tcp',
    name: 'Early English Books Online Text Creation Partnership',
    shortName: 'EEBO-TCP',
    description:
      'Keyboarded and encoded transcriptions of early printed books, preserving original spelling. Used here for the 1623 First Folio (STC 22273).',
    url: 'https://textcreationpartnership.org/',
    license: {
      name: 'CC0 1.0 Universal',
      url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      commercialUse: true,
    },
    attribution:
      'Transcription by the Text Creation Partnership (EEBO-TCP Phase I), dedicated to the public domain under CC0 1.0.',
  },
];

export interface FolgerSource {
  kind: 'folger';
  /** Key in sources.lock.json. */
  lockKey: string;
}

export interface TcpSource {
  kind: 'tcp';
  lockKey: string;
  /** Matches the play's heading in the TCP file. */
  title: RegExp;
  /** Prefix for IDs allocated to this version's nodes. */
  idPrefix: string;
}

export type VersionConfig = PlayInfo['versions'][number] & { source: FolgerSource | TcpSource };

export interface PlayConfig {
  info: Omit<PlayInfo, 'versions'>;
  versions: VersionConfig[];
}

const folgerVersion = (lockKey: string): VersionConfig => ({
  id: 'folger',
  name: 'Folger edition',
  shortName: 'Folger',
  kind: 'modern',
  sourceIds: ['folger'],
  source: { kind: 'folger', lockKey },
});

const firstFolio = (title: RegExp, idPrefix: string): VersionConfig => ({
  id: 'f1-1623',
  name: 'First Folio (1623)',
  shortName: 'F1',
  kind: 'original',
  printed: 1623,
  sourceIds: ['eebo-tcp'],
  source: { kind: 'tcp', lockKey: 'tcp-first-folio', title, idPrefix },
});

export const PLAYS: PlayConfig[] = [
  {
    info: {
      id: 'hamlet',
      title: 'Hamlet',
      shortTitle: 'Hamlet',
      genre: 'tragedy',
      composed: { from: 1599, to: 1601 },
      modernVersionId: 'folger',
    },
    versions: [folgerVersion('folger-hamlet')],
  },
  {
    info: {
      id: 'the-tempest',
      title: 'The Tempest',
      shortTitle: 'Tempest',
      genre: 'romance',
      composed: { from: 1610, to: 1611 },
      modernVersionId: 'folger',
    },
    versions: [folgerVersion('folger-the-tempest'), firstFolio(/TEMPEST/, 'tmp-f1')],
  },
  {
    info: {
      id: 'troilus-and-cressida',
      title: 'Troilus and Cressida',
      shortTitle: 'Troilus',
      genre: 'problem',
      composed: { from: 1601, to: 1602 },
      modernVersionId: 'folger',
    },
    versions: [folgerVersion('folger-troilus-and-cressida')],
  },
];
