import type { CollectionRecord } from './types';

/** Paper import by DOI or arXiv ID (build.md R2) and BibTeX export (R3). */

export type PaperId = { kind: 'doi'; doi: string } | { kind: 'arxiv'; id: string };

/** Accepts "10.1145/…", "https://doi.org/10…", "arXiv:2303.04137v2", "https://arxiv.org/abs/2303.04137", "cs/0112017". */
export function parsePaperId(input: string): PaperId | null {
  const s = input.trim();
  const arxiv =
    s.match(/arxiv\.org\/(?:abs|pdf)\/([\w./-]+?)(?:v\d+)?(?:\.pdf)?$/i) ??
    s.match(/^(?:arxiv:)?\s*(\d{4}\.\d{4,5})(?:v\d+)?$/i) ??
    s.match(/^(?:arxiv:)?\s*([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i);
  if (arxiv) return { kind: 'arxiv', id: arxiv[1]! };
  const doi = s.match(/(10\.\d{4,9}\/\S+)$/);
  if (doi) {
    const d = doi[1]!.replace(/[.,;]$/, '');
    // arXiv's own DOIs are registered with DataCite, like plain arXiv IDs.
    const ax = d.match(/^10\.48550\/arxiv\.(.+)$/i);
    return ax ? { kind: 'arxiv', id: ax[1]! } : { kind: 'doi', doi: d };
  }
  return null;
}

export interface PaperData {
  title: string;
  authors: string;
  year?: number;
  venue?: string;
  link: string;
  summary?: string;
}

const MAX_AUTHORS = 8;
const joinAuthors = (names: string[]) =>
  names.length > MAX_AUTHORS ? `${names.slice(0, MAX_AUTHORS).join(', ')} et al.` : names.join(', ');
const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

interface CrossrefWork {
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  'container-title'?: string[];
  issued?: { 'date-parts'?: number[][] };
  published?: { 'date-parts'?: number[][] };
  DOI: string;
  abstract?: string;
}

export function fromCrossref(m: CrossrefWork): PaperData {
  const year = (m.issued ?? m.published)?.['date-parts']?.[0]?.[0];
  return {
    title: clean(m.title?.[0] ?? m.DOI),
    authors: joinAuthors(
      (m.author ?? []).map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(' ')),
    ),
    ...(year ? { year } : {}),
    ...(m['container-title']?.[0] ? { venue: clean(m['container-title'][0]) } : {}),
    link: `https://doi.org/${m.DOI}`,
    ...(m.abstract ? { summary: clean(m.abstract) } : {}),
  };
}

interface DataCiteAttributes {
  titles?: { title: string }[];
  creators?: { name: string; givenName?: string; familyName?: string }[];
  publicationYear?: number;
  publisher?: string | { name?: string };
  url?: string;
  doi: string;
  descriptions?: { description?: string; descriptionType?: string }[];
}

export function fromDataCite(a: DataCiteAttributes): PaperData {
  const publisher = typeof a.publisher === 'string' ? a.publisher : a.publisher?.name;
  const abstract = a.descriptions?.find((d) => d.descriptionType === 'Abstract') ?? a.descriptions?.[0];
  return {
    title: clean(a.titles?.[0]?.title ?? a.doi),
    authors: joinAuthors(
      (a.creators ?? []).map((c) =>
        c.givenName && c.familyName ? `${c.givenName} ${c.familyName}` : c.name,
      ),
    ),
    ...(a.publicationYear ? { year: Number(a.publicationYear) } : {}),
    ...(publisher ? { venue: publisher } : {}),
    link: a.url ?? `https://doi.org/${a.doi}`,
    ...(abstract?.description ? { summary: clean(abstract.description) } : {}),
  };
}

/** Look a paper up. Needs the internet; the services are free and need no account. */
export async function fetchPaper(id: PaperId, fetcher: typeof fetch = fetch): Promise<PaperData> {
  const url =
    id.kind === 'doi'
      ? `https://api.crossref.org/works/${encodeURIComponent(id.doi)}`
      : `https://api.datacite.org/dois/${encodeURIComponent(`10.48550/arXiv.${id.id}`)}`;
  let res: Response;
  try {
    res = await fetcher(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Couldn’t reach the paper service. Are you online?');
  }
  if (res.status === 404)
    throw new Error(id.kind === 'doi' ? 'No paper with that DOI.' : 'No arXiv paper with that ID.');
  if (!res.ok) throw new Error(`The paper service answered ${res.status}. Try again later.`);
  const json = (await res.json()) as { message?: CrossrefWork; data?: { attributes: DataCiteAttributes } };
  return id.kind === 'doi' ? fromCrossref(json.message!) : fromDataCite(json.data!.attributes);
}

/* ---------- BibTeX ---------- */

const bibEscape = (s: string) => s.replace(/([{}\\])/g, '\\$1');

/** "Chi2023diffusion": first author's family name, year, first real word of the title. */
function citeKey(r: CollectionRecord, used: Set<string>) {
  const authors = String(r.custom.authors ?? '');
  const first = authors.split(',')[0]?.trim().split(' ').at(-1) ?? 'paper';
  const word =
    r.title
      .toLowerCase()
      .split(/\W+/)
      .find((w) => w.length > 3 && !['with', 'from', 'this', 'that', 'towards'].includes(w)) ?? 'paper';
  const base = `${first.replace(/\W/g, '')}${r.custom.year ?? ''}${word}`;
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}${i}`;
  used.add(key);
  return key;
}

export function toBibTeX(papers: CollectionRecord[]): string {
  const used = new Set<string>();
  return papers
    .map((r) => {
      const link = String(r.custom.link ?? '');
      const doi = link.match(/doi\.org\/(.+)$/)?.[1];
      const arxiv = link.match(/arxiv\.org\/abs\/(.+)$/)?.[1];
      const fields: [string, unknown][] = [
        ['title', `{${r.title}}`],
        [
          'author',
          String(r.custom.authors ?? '')
            .replace(/,\s*/g, ' and ')
            .replace(/ et al\.$/, ' and others'),
        ],
        ['year', r.custom.year],
        [arxiv ? 'journal' : 'booktitle', arxiv ? `arXiv preprint arXiv:${arxiv}` : r.custom.venue],
        ['doi', doi],
        ['url', !doi ? link || undefined : undefined],
      ];
      const body = fields
        .filter(([, v]) => v !== undefined && v !== '' && v !== null)
        .map(([k, v]) => `  ${k} = {${bibEscape(String(v))}}`)
        .join(',\n');
      return `@${arxiv ? 'article' : r.custom.venue ? 'inproceedings' : 'misc'}{${citeKey(r, used)},\n${body}\n}`;
    })
    .join('\n\n');
}
