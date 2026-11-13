import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { QuestionText } from '../src/ui/QuestionText';

it('renders reviewed inline citations without changing surrounding factual context', () => {
  const html = renderToStaticMarkup(createElement(QuestionText, {
    text: 'Politische Interessen. [Archiv](https://example.org/source) Danach änderte sich die Ordnung.',
    allowedUrls: ['https://example.org/source'],
  }));
  expect(html).toContain('Politische Interessen. ');
  expect(html).toContain('href="https://example.org/source"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain('>Archiv</a> Danach änderte sich die Ordnung.');
  expect(html).not.toContain('[Archiv]');
});

it('keeps HTML and unreviewed or executable links inert as escaped text', () => {
  const html = renderToStaticMarkup(createElement(QuestionText, {
    text: '<img src=x onerror=alert(1)> [X](javascript:alert) [Other](https://unreviewed.example/)',
    allowedUrls: ['https://example.org/source'],
  }));
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<a');
  expect(html).toContain('&lt;img');
  expect(html).toContain('[X](javascript:alert)');
  expect(html).toContain('[Other](https://unreviewed.example/)');
});
