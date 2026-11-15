import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HistoryApp, type CivicsQuestion, type HistoryAppProps } from '../src/ui/HistoryApp';

const civics: CivicsQuestion = {
  id: 'civics-ui-test',
  prompt: 'Wer beschließt Bundesgesetze?',
  fact: 'Der Bundestag beschließt Bundesgesetze.',
  explanation: 'Der Bundesrat wirkt nach Maßgabe des Grundgesetzes mit.',
  sensitivity: 'none',
  choices: [
    { id: 'parliament', text: 'Der Bundestag' },
    { id: 'court', text: 'Das Bundesverfassungsgericht' },
  ],
  sources: [{ title: 'Grundgesetz', publisher: 'Bund', url: 'https://www.gesetze-im-internet.de/gg/art_77.html' }],
};

function render(overrides: Partial<HistoryAppProps> = {}) {
  const props: HistoryAppProps = {
    question: { ...civics, startYear: 1871, endYear: 1871 },
    xp: 10, attemptedCount: 1, latestCorrectCount: 1, totalQuestions: 20,
    range: { startYear: 1701, endYear: 2024 },
    availableYearBounds: { startYear: 1701, endYear: 2024 },
    phase: 'asking', selectedChoiceId: null, correctChoiceId: null, wasCorrect: null,
    storageNotice: null, error: null,
    onSelectChoice: vi.fn(), onSubmit: vi.fn(), onNext: vi.fn(),
    onRangeChange: vi.fn(), onResetProgress: vi.fn(),
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HistoryApp, props));
}

describe('controlled civics presentation', () => {
  it('offers distinct learning categories without simulating a controller selection', () => {
    const change = vi.fn();
    const html = render({ onCategoryChange: change });
    expect(html).toContain('<label for="history-category">Lernbereich</label>');
    expect(html).toContain('<option value="history" selected="">Geschichte</option>');
    expect(html).toContain('<option value="civics">Politische Bildung</option>');
    expect(html).toContain('Geschichte eingrenzen');
    expect(change).not.toHaveBeenCalled();
    expect(render()).not.toContain('<select');
  });

  it('accepts undated civics and removes every event-year control, label and period count', () => {
    const html = render({ category: 'civics', onCategoryChange: vi.fn(), question: civics });
    expect(html).toContain('<option value="civics" selected="">Politische Bildung</option>');
    expect(html).toContain('Dein Überblick für Politische Bildung');
    expect(html).toContain('Fragenzahlen gelten für Politische Bildung.');
    expect(html).not.toContain('Von Jahr');
    expect(html).not.toContain('Bis Jahr');
    expect(html).not.toContain('Filter anwenden');
    expect(html).not.toContain('Zeitraum:');
    expect(html).not.toContain('1701');
    expect(html).not.toContain('2024');
  });

  it('never presents a dated payload as an event date in civics mode', () => {
    const html = render({ category: 'civics', onCategoryChange: vi.fn() });
    expect(html).not.toContain('1871');
    expect(html).not.toContain('1701');
    expect(html).not.toContain('2024');
  });

  it('keeps an empty civic category explicit instead of offering a historical time filter', () => {
    const html = render({ category: 'civics', onCategoryChange: vi.fn(), question: null, phase: 'empty' });
    expect(html).toContain('Für Politische Bildung ist gerade keine Frage verfügbar.');
    expect(html).toContain('Zur Geschichte wechseln');
    expect(html).not.toContain('Zum Zeitfilter');
    expect(html).not.toContain('Filter anwenden');
  });
});

it.each([true, false])('keeps facts, context and sources visible immediately after an answer (correct=%s)', correct => {
  const html = render({
    category: 'civics', question: civics, phase: 'answered',
    selectedChoiceId: correct ? 'parliament' : 'court', correctChoiceId: 'parliament', wasCorrect: correct,
  });
  expect(html).toContain('Fakten und Einordnung');
  expect(html).toContain(civics.fact);
  expect(html).toContain(civics.explanation);
  expect(html).toContain(`href="${civics.sources[0].url}"`);
  expect(html).toContain(correct ? 'Richtig beantwortet.' : 'Noch nicht richtig.');
  expect(html).toContain('<fieldset class="history-choices" disabled="">');
  expect(html).toContain('Nächste Frage');
  expect(html).not.toContain('Fakt &amp; Einordnung ansehen');
  expect(html).not.toContain('Historischer Fakt');
  expect(html).not.toContain('Zur Antwortseite');
});

it('does not disclose facts, context or sources before an answer', () => {
  const html = render({ category: 'civics', question: civics });
  expect(html).not.toContain(civics.fact);
  expect(html).not.toContain(civics.explanation);
  expect(html).not.toContain(`href="${civics.sources[0].url}"`);
  expect(html).not.toContain('Fakten und Einordnung</h3>');
});
