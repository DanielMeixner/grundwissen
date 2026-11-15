import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBank, parseQuestion } from '../scripts/content-parser';
import { validateBank } from '../src/domain/question';
import { fixture } from './fixtures';

function contentFiles(directory: string) {
  return readdirSync(directory).filter(name => name.endsWith('.md')).sort()
    .map(name => {
      const file = `${directory}/${name}`;
      return { file, source: readFileSync(file, 'utf8') };
    });
}

describe('content parser', () => {
  it('validates the expanded history and civics banks without mixing their snapshots', () => {
    const historyFiles = [
      ...['18', '19', '20', '21'].flatMap(century => contentFiles(`content/questions/${century}`)),
      ...contentFiles('content/deutschland-verstehen'),
    ];
    const civicsFiles = contentFiles('content/political-literacy');
    const history = parseBank(historyFiles);
    const civics = parseBank(civicsFiles);

    expect(history).toHaveLength(360);
    for (const century of [18, 19, 20, 21]) {
      expect(history.filter(question => Math.ceil(question.startYear / 100) === century)).toHaveLength(90);
    }
    expect(civics).toHaveLength(222);
    expect(civics.every(question => question.startYear === 2026 && question.endYear === 2026 &&
      question.topics.includes('Politische Bildung'))).toBe(true);
    expect(new Set([...history, ...civics].map(question => question.id)).size).toBe(582);
    for (const question of [...history, ...civics]) {
      const linkedUrls = [...question.explanation.matchAll(/\[([^\]\n]+)\]\((https?:\/\/(?:[^()\s]|\([^()\s]*\))*)\)/g)]
        .map(match => match[2]);
      for (const source of question.sources) expect(linkedUrls).toContain(source.url);
    }
  });

  it('parses factual context, sources and stable revision', () => {
    const question = parseQuestion('fixture.md', fixture);
    expect(question.explanation).toContain('politischen Interessen');
    expect(question.sources[0].accessed).toBe('2026-11-13');
    expect(question.contentRevision).toBe(parseQuestion('fixture.md', fixture).contentRevision);
    expect(parseQuestion('fixture.md', fixture.replace('politischen', 'sozialen')).contentRevision)
      .not.toBe(question.contentRevision);
    expect(validateBank([question])).toHaveLength(1);
  });
  it.each([
    ['invalid date', 'verifiedOn: 2026-11-13', 'verifiedOn: 2026-02-30', 'verifiedOn'],
    ['missing field', 'difficulty: 1\n', '', 'difficulty'],
    ['duplicate choices', 'id: b', 'id: a', 'choices'],
    ['duplicate choice text', 'Zweite Antwort', 'Erste Antwort', 'choices'],
    ['bad answer reference', 'correctChoiceId: a', 'correctChoiceId: x', 'correctChoiceId'],
    ['non-integer year', 'startYear: 1701', 'startYear: 1701.5', 'startYear'],
    ['reversed years', 'endYear: 1702', 'endYear: 1700', 'endYear'],
    ['wrong sections', '## Historischer Fakt', '## Antwort', 'sections'],
    ['bad source date', 'accessed: 2026-11-13', 'accessed: 2025-02-29', 'sources.0.accessed'],
  ])('rejects %s with filename and field', (_, from, to, field) => {
    expect(() => parseQuestion('bad.md', fixture.replace(from, to))).toThrow(`bad.md:`);
    expect(() => parseQuestion('bad.md', fixture.replace(from, to))).toThrow(field);
  });
  it('excludes valid drafts, validates invalid drafts, and rejects duplicate IDs across statuses', () => {
    const draft = fixture.replace('status: reviewed', 'status: draft');
    expect(parseBank([{ file: 'draft.md', source: draft }])).toEqual([]);
    expect(() => parseBank([{ file: 'draft.md', source: draft.replace('difficulty: 1', 'difficulty: 5') }]))
      .toThrow('difficulty');
    expect(() => parseBank([{ file: 'one.md', source: fixture }, { file: 'two.md', source: draft }]))
      .toThrow('two.md: id: Duplicate');
  });
  it('rejects duplicate YAML keys and missing options', () => {
    expect(() => parseQuestion('bad.md', fixture.replace('revision: 1', 'revision: 1\nrevision: 1')))
      .toThrow('bad.md: YAML');
    expect(() => parseQuestion('bad.md', fixture.replace('  - { id: d, text: Vierte Antwort }\n', '')))
      .toThrow('choices');
  });
});
