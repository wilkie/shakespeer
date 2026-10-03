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
  {
    id: 'schmidt-1902',
    name: 'Schmidt, Shakespeare-Lexicon (3rd edition, 1902)',
    shortName: 'Schmidt',
    description:
      'Alexander Schmidt, Shakespeare-Lexicon: A Complete Dictionary of All the English Words, Phrases and Constructions in the Works of the Poet, 3rd edition, revised and enlarged by Gregor Sarrazin (Berlin: Georg Reimer, 1902). Definitions are matched to the passages the Lexicon cites; its text was recovered from scans digitized by the Internet Archive.',
    url: 'https://archive.org/details/shakespearelexic0001alex_j8y5',
    license: {
      name: 'Public domain',
      url: 'https://creativecommons.org/publicdomain/mark/1.0/',
      commercialUse: true,
    },
    attribution:
      'Alexander Schmidt, Shakespeare-Lexicon, 3rd ed., rev. Gregor Sarrazin (1902). Public domain. Scans by the Internet Archive.',
  },
  {
    id: 'onions-1919',
    name: 'Onions, A Shakespeare Glossary (2nd edition, 1919)',
    shortName: 'Onions',
    description:
      'C. T. Onions, A Shakespeare Glossary, 2nd edition, revised (Oxford: Clarendon Press, 1919). Definitions are matched to the passages the Glossary cites; its text was recovered from scans digitized by the Internet Archive.',
    url: 'https://archive.org/details/shakespeareglos00onio',
    license: {
      name: 'Public domain in the United States',
      url: 'https://creativecommons.org/publicdomain/mark/1.0/',
      commercialUse: true,
    },
    attribution:
      'C. T. Onions, A Shakespeare Glossary, 2nd ed. (1919). Public domain in the United States (published 1919). Scans by the Internet Archive.',
  },
];

export interface GlossaryConfig {
  sourceId: string;
  /** Which parser reads the glossary's layout. */
  format: 'schmidt' | 'onions';
  /** Lock keys of the volumes' OCR text, in alphabetical order. */
  volumes: { lockKey: string; start: RegExp; end?: string }[];
  /** The glossary's abbreviation for each play it cites. */
  playAbbreviations: Record<string, string>;
}

export const GLOSSARIES: GlossaryConfig[] = [
  {
    sourceId: 'schmidt-1902',
    format: 'schmidt',
    volumes: [
      { lockKey: 'schmidt-1902-v1', start: /\n\nA\.\s*\n/ },
      { lockKey: 'schmidt-1902-v2', start: /\n\nM\.\s*\n/, end: 'I. Grammatical Observations' },
    ],
    playAbbreviations: { hamlet: 'Hml', 'the-tempest': 'Tp', 'troilus-and-cressida': 'Troil' },
  },
  {
    sourceId: 'onions-1919',
    format: 'onions',
    volumes: [{ lockKey: 'onions-1919', start: /\n\s*a1?\s*:/, end: 'ADDENDA' }],
    playAbbreviations: { hamlet: 'Ham', 'the-tempest': 'Tp', 'troilus-and-cressida': 'Troil' },
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
    versions: [folgerVersion('folger-hamlet'), firstFolio(/HAMLET/, 'ham-f1')],
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
    versions: [
      folgerVersion('folger-troilus-and-cressida'),
      firstFolio(/Troylus and Cre/, 'tro-f1'),
    ],
  },
];
