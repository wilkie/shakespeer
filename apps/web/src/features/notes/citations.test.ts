import { describe, expect, it } from '@jest/globals';

import { formatCitation, parseCitationText, parseName } from './citations';

describe('parseCitationText', () => {
  it('ANN-005: reads BibTeX entries, several at once', () => {
    const citations = parseCitationText(`
@book{schmidt1902,
  author = {Schmidt, Alexander and Gregor Sarrazin},
  title = {{Shakespeare-Lexicon}: A Complete Dictionary},
  publisher = {Georg Reimer},
  address = {Berlin},
  year = 1902,
  edition = {3}
}
@article{greenblatt,
  author = "Stephen Greenblatt",
  title = "The Cultivation of Anxiety",
  journal = {Raritan},
  volume = {2}, number = {1},
  pages = {61--85},
  year = {1982},
  doi = {10.0000/example}
}`);

    expect(citations).toStrictEqual([
      {
        type: 'book',
        title: 'Shakespeare-Lexicon: A Complete Dictionary',
        author: [
          { family: 'Schmidt', given: 'Alexander' },
          { family: 'Sarrazin', given: 'Gregor' },
        ],
        issued: { 'date-parts': [[1902]] },
        publisher: 'Georg Reimer',
        'publisher-place': 'Berlin',
      },
      {
        type: 'article-journal',
        title: 'The Cultivation of Anxiety',
        author: [{ family: 'Greenblatt', given: 'Stephen' }],
        issued: { 'date-parts': [[1982]] },
        'container-title': 'Raritan',
        volume: '2',
        issue: '1',
        page: '61–85',
        DOI: '10.0000/example',
      },
    ]);
  });

  it('ANN-005: reads RIS records', () => {
    expect(
      parseCitationText(`TY  - CHAP
AU  - Orgel, Stephen
TI  - The Authentic Shakespeare
T2  - Representations
PY  - 1988/01/15
SP  - 1
EP  - 25
UR  - https://example.org/orgel
ER  - `),
    ).toStrictEqual([
      {
        type: 'chapter',
        title: 'The Authentic Shakespeare',
        author: [{ family: 'Orgel', given: 'Stephen' }],
        issued: { 'date-parts': [[1988, 1, 15]] },
        'container-title': 'Representations',
        page: '1–25',
        URL: 'https://example.org/orgel',
      },
    ]);
  });

  it('ANN-005: reads CSL-JSON', () => {
    expect(
      parseCitationText('[{"type":"book","title":"Hamlet","author":[{"literal":"Folger"}]}]'),
    ).toStrictEqual([{ type: 'book', title: 'Hamlet', author: [{ literal: 'Folger' }] }]);
  });

  it('returns nothing for unrecognized text', () => {
    expect(parseCitationText('just some words')).toStrictEqual([]);
  });
});

describe('names and display', () => {
  it('parses "Family, Given", "Given Family" and literal names', () => {
    expect(parseName('Mowat, Barbara A.')).toStrictEqual({ family: 'Mowat', given: 'Barbara A.' });
    expect(parseName('Paul Werstine')).toStrictEqual({ family: 'Werstine', given: 'Paul' });
    expect(parseName('{Folger Shakespeare Library}')).toStrictEqual({
      literal: 'Folger Shakespeare Library',
    });
  });

  it('ANN-006: formats citations consistently, linking the DOI', () => {
    expect(
      formatCitation({
        type: 'article-journal',
        title: 'The Cultivation of Anxiety',
        author: [{ family: 'Greenblatt', given: 'Stephen' }],
        issued: { 'date-parts': [[1982]] },
        'container-title': 'Raritan',
        volume: '2',
        issue: '1',
        page: '61–85',
        DOI: '10.0000/example',
      }),
    ).toStrictEqual({
      text: 'Stephen Greenblatt. “The Cultivation of Anxiety”. Raritan. 2 (1). 1982. pp. 61–85.',
      href: 'https://doi.org/10.0000/example',
    });
  });
});
