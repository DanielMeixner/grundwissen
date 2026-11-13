import { parseQuestion } from '../scripts/content-parser';
import type { EngineEnvironment } from '../src/domain/engine';

export const fixture = `---
id: test-1701
revision: 1
status: reviewed
verifiedOn: 2026-11-13
startYear: 1701
endYear: 1702
topics: [Politik]
territories: [Europa]
difficulty: 1
sensitivity: low
choices:
  - { id: a, text: Erste Antwort }
  - { id: b, text: Zweite Antwort }
  - { id: c, text: Dritte Antwort }
  - { id: d, text: Vierte Antwort }
correctChoiceId: a
sources:
  - { title: Quelle, publisher: Archiv, url: "https://example.org/history", accessed: 2026-11-13 }
---
## Frage
Welche Antwort stimmt?
## Historischer Fakt
Der historische Fakt mit Datum.
## Erklärung
Ein Konflikt zwischen mehreren Akteuren entstand aus politischen Interessen.
Seine Folgen beeinflussten die folgenden Jahrzehnte und erklaeren seine Bedeutung.
`;

export function questions(count = 4) {
  const question = parseQuestion('fixture.md', fixture);
  return Array.from({ length: count }, (_, index) => ({
    ...question,
    id: `q${index}`,
    startYear: 1701 + index * 100,
    endYear: 1702 + index * 100,
  }));
}

export function environment(): EngineEnvironment {
  let sequence = 0;
  return {
    random: () => 0.37,
    uuid: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  };
}
