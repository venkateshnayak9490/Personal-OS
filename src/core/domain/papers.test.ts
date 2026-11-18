import { describe, expect, it } from 'vitest';
import { newBase } from './entity';
import { fetchPaper, fromCrossref, fromDataCite, parsePaperId, toBibTeX } from './papers';

describe('paper identifiers', () => {
  it.each([
    ['10.1145/3292500.3330701', { kind: 'doi', doi: '10.1145/3292500.3330701' }],
    ['https://doi.org/10.1145/3292500.3330701', { kind: 'doi', doi: '10.1145/3292500.3330701' }],
    ['arXiv:2303.04137v2', { kind: 'arxiv', id: '2303.04137' }],
    ['2303.04137', { kind: 'arxiv', id: '2303.04137' }],
    ['https://arxiv.org/abs/2303.04137v1', { kind: 'arxiv', id: '2303.04137' }],
    ['https://arxiv.org/pdf/2303.04137.pdf', { kind: 'arxiv', id: '2303.04137' }],
    ['10.48550/arXiv.2303.04137', { kind: 'arxiv', id: '2303.04137' }],
    ['cs/0112017', { kind: 'arxiv', id: 'cs/0112017' }],
  ])('%s', (input, out) => expect(parsePaperId(input)).toEqual(out));

  it('rejects other text', () => expect(parsePaperId('diffusion policy')).toBeNull());
});

describe('lookups', () => {
  it('Crossref: title, authors, year, venue, DOI link', () => {
    expect(
      fromCrossref({
        title: ['Optuna'],
        author: [
          { given: 'Takuya', family: 'Akiba' },
          { given: 'Shotaro', family: 'Sano' },
        ],
        'container-title': ['Proceedings of the 25th ACM SIGKDD &amp; Data Mining'],
        issued: { 'date-parts': [[2019, 7, 25]] },
        DOI: '10.1145/3292500.3330701',
      }),
    ).toEqual({
      title: 'Optuna',
      authors: 'Takuya Akiba, Shotaro Sano',
      year: 2019,
      venue: 'Proceedings of the 25th ACM SIGKDD & Data Mining',
      link: 'https://doi.org/10.1145/3292500.3330701',
    });
  });

  it('DataCite (arXiv): abstract becomes the summary', () => {
    expect(
      fromDataCite({
        titles: [{ title: 'Diffusion Policy: Visuomotor Policy Learning via Action Diffusion' }],
        creators: [{ name: 'Chi, Cheng', givenName: 'Cheng', familyName: 'Chi' }],
        publicationYear: 2023,
        publisher: 'arXiv',
        url: 'https://arxiv.org/abs/2303.04137',
        doi: '10.48550/arXiv.2303.04137',
        descriptions: [
          { description: 'This paper introduces Diffusion Policy.', descriptionType: 'Abstract' },
        ],
      }),
    ).toMatchObject({
      authors: 'Cheng Chi',
      year: 2023,
      venue: 'arXiv',
      summary: 'This paper introduces Diffusion Policy.',
    });
  });

  it('explains failures in plain words', async () => {
    const notFound = (async () => new Response('', { status: 404 })) as typeof fetch;
    await expect(fetchPaper({ kind: 'doi', doi: '10.1/x' }, notFound)).rejects.toThrow(
      'No paper with that DOI.',
    );
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(fetchPaper({ kind: 'arxiv', id: '2303.04137' }, offline)).rejects.toThrow(/Are you online/);
  });
});

describe('BibTeX', () => {
  it('makes readable cite keys and fields', () => {
    const rec = (title: string, custom: Record<string, unknown>) => ({
      ...newBase('d'),
      collectionId: 'c',
      title,
      status: 'Read',
      custom,
      tags: [],
      order: 'a0',
    });
    const bib = toBibTeX([
      rec('Diffusion Policy: Visuomotor Policy Learning', {
        authors: 'Cheng Chi, Zhenjia Xu',
        year: 2023,
        link: 'https://arxiv.org/abs/2303.04137',
      }),
      rec('Optuna', {
        authors: 'Takuya Akiba',
        year: 2019,
        venue: 'KDD',
        link: 'https://doi.org/10.1145/3292500.3330701',
      }),
    ]);
    expect(bib).toContain('@article{Chi2023diffusion,');
    expect(bib).toContain('author = {Cheng Chi and Zhenjia Xu}');
    expect(bib).toContain('journal = {arXiv preprint arXiv:2303.04137}');
    expect(bib).toContain('@inproceedings{Akiba2019optuna,');
    expect(bib).toContain('doi = {10.1145/3292500.3330701}');
  });
});
