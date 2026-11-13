import { describe, expect, it } from 'vitest';
import { parseBank, parseQuestion } from '../scripts/content-parser';
import { validateBank } from '../src/domain/question';
import { fixture } from './fixtures';

describe('content parser', () => {
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
