# Grundwissen

Ein deutschsprachiges Geschichtsquiz zum Verstehen statt blossen Auswendiglernen: 160 redaktionell gepruefte Fragen, historischer Fakt, Hintergrund, beteiligte Akteure, Bedeutung und nachlesbare Quellen. Vier Jahrhunderte enthalten je 40 Fragen. Der Zeitraum ab 2001 endet am tatsaechlich verfassten letzten Ereignis, nicht an einem erfundenen Zukunftsjahr.

## Lokal starten

Node.js 22.18 oder neuer und npm werden benoetigt.

```sh
npm ci
npm run dev
```

Die Vite-Adresse mit `/grundwissen/` oeffnen. `npm test` prueft Parser, Zeitgrenzen, Runden und Speicherung. `npm run build` validiert die vollstaendige Fragenbank, prueft TypeScript und erzeugt `dist/`. Fuer Browserpruefungen:

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

## Spielregeln und Fortschritt

Zeitraeume sind ganzzahlige, inklusive Intervalle. Ein Ereignis kommt vor, wenn sein Intervall den gewaehlten Zeitraum ueberschneidet. Ungueltige Eingaben erzeugen eine Meldung; ein leerer Zeitraum bleibt leer. Jahrhundertvorgaben sind 1701–1800, 1801–1900, 1901–2000 und 2001 bis zum verfassten Endjahr.

Jede passende Frage erscheint einmal pro Runde. Neue beziehungsweise inhaltlich geaenderte Fragen kommen zuerst, danach zuletzt falsch, danach zuletzt richtig beantwortete Fragen; jede Gruppe wird gemischt. Ein unmittelbarer Rundenwechsel wiederholt die letzte Frage nur, wenn keine Alternative existiert. Die Vermeidung eines solchen Grenzwiederholers hat fuer die erste Frage Vorrang vor der Gruppenprioritaet.

Erst Auswahl und ausdrueckliches Pruefen schliessen einen Versuch ab. Richtig gibt +10 XP, falsch 0, ohne Abzug, Zeitlimit oder Leben. Jeder neue Versuch kann erneut XP verdienen, aber nie zweimal derselbe Versuch. Antwortreihenfolge, Auswahl, Rueckmeldung, XP und Statistik bilden einen atomaren gespeicherten Stand. XP zeigen lebenslange Uebung, **keine Beherrschung**. Abdeckung und „zuletzt richtig“ beziehen sich nur auf die aktive Fragenmenge und die aktuelle Inhaltsfassung; eine Inhaltsaenderung invalidiert diese Anzeigen, nicht die bisherigen XP.

## Browserprofil und Speichergrenzen

Kein Konto, Login, Server, Datenbank oder Laufzeit-KI. Fortschritt liegt in `localStorage` unter `grundwissen.progress` pro Browserprofil und Origin. Ein anderer Browser, ein anderes Profil oder eine andere Origin hat einen eigenen Stand. Loeschen von Browserdaten, Privatmodus, Geraetewechsel oder bewusstes Zuruecksetzen koennen den Fortschritt verlieren. Es gibt keinen automatischen Backup-Dienst.

Web Locks koordinieren Lesen–Pruefen–Schreiben zwischen Tabs: die erste Antwort auf einen Versuch gewinnt; Storage-Ereignisse aktualisieren andere Tabs. Wenn Web Locks oder Speicher fehlen beziehungsweise Speicherzugriff oder Quote scheitern, erscheint sichtbar **Nur diese Sitzung**. Es wird kein dauerhafter Erfolg vorgetaeuscht. Beschaedigte oder unbekannte Speicherfassungen bleiben unangetastet, bis die Person ausdruecklich zuruecksetzt. Das Schema Version 2 erkennt und migriert ausschliesslich die dokumentierte Version 1 (gleiche Felder, ohne `scoringPolicy` und `bankRevision`); unbekannte Versionen werden nicht geraten. Das Auditprotokoll haelt die letzten 100 Versuche; aggregierte Zahlen bleiben erhalten. Eine geaenderte Fragenbank baut die verbleibende Runde neu auf, behaelt aber eine unveraenderte aktuelle Antwort samt XP und Antwortreihenfolge.

Wenn gleichzeitig Tabs mit unterschiedlichen Fragenfassungen offen sind, schreibt ein Tab mit abweichendem Stand nicht zurueck: Er wechselt sichtbar in den Sitzungsmodus und bittet um Neuladen. So entsteht keine gegenseitige Speicher-Ereignisschleife.

Der vorbereitete Importadapter verlangt ausdrueckliche Zustimmung und liefert Profil-/Revisions-Idempotenzschluessel. Er sendet nichts und implementiert keine Anmeldung. Lokal editierbare XP sind **nicht vertrauenswuerdig** fuer spaetere Kontoranglisten; ein kuenftiger Server muss Importe selbst deduplizieren und seine Bewertungsregeln festlegen.

## Fragen bearbeiten

Dateien liegen unter `content/questions/{18,19,20,21}/*.md`, sind UTF-8 und beginnen mit YAML:

```yaml
---
id: eindeutige-stabile-id
revision: 1
status: reviewed
verifiedOn: 2026-11-13
startYear: 1701
endYear: 1701
topics: [Politik]
territories: [Europa]
difficulty: 1
sensitivity: low
choices:
  - { id: a, text: Antwort A }
  - { id: b, text: Antwort B }
  - { id: c, text: Antwort C }
  - { id: d, text: Antwort D }
correctChoiceId: a
sources:
  - title: Quellentitel
    publisher: Herausgeber
    url: https://example.org/quelle
    accessed: 2026-11-13
---
```

Danach folgen genau `## Frage`, `## Historischer Fakt` und `## Erklärung` in dieser Reihenfolge. Alle Abschnitte sind erforderlich. Die Erklaerung soll Ursachen/Hintergrund, Akteure und historische Bedeutung vermitteln, nicht nur die richtige Antwort wiederholen. Datumswerte muessen reale Kalendertage sein; Options- und Frage-IDs muessen eindeutig sein. `correctChoiceId` verweist auf eine der vier Optionen. Schwierigkeit ist 1, 2 oder 3; Sensitivitaet `low`, `medium` oder `high`. Quellen muessen HTTP(S)-Adressen mit Titel, Herausgeber und Zugriffstag haben.

`npm run content` meldet Datei und betroffenes Feld bei Fehlern. Auch Entwuerfe (`draft`) werden strukturell validiert, aber nicht veroeffentlicht. Der Release erwartet genau 160 freigegebene Fragen, 40 pro Jahrhundert. Ein SHA-256 ueber den Dateiinhalt identifiziert jede aktuelle Inhaltsfassung. Zur Laufzeit wird das erzeugte JSON nochmals validiert. Rohes HTML wird nicht ausgefuehrt; die Oberflaeche stellt die Abschnitte als escaped Text dar und rendert ausschliesslich Inline-Quellenlinks, deren HTTP(S)-Adresse in den geprueften Quellen der Frage steht. Andere Linksyntax bleibt inerter Text. Die Markdown-Dateien dienen als redaktionelles Strukturformat.

`reviewed` und `verifiedOn` dokumentieren die Quellenpruefung durch den erstellenden Agenten, **kein erfundenes fachwissenschaftliches oder externes Expertengutachten**. Quellenlinks ermoeglichen Nachpruefung, garantieren aber keine dauerhafte Verfuegbarkeit. Fragen koennen vereinfachen; sensible Themen brauchen weiterhin redaktionelle Aufmerksamkeit.

## GitHub Pages

Der Workflow `.github/workflows/pages.yml` prueft jeden Branch-Push sowie `workflow_dispatch` mit `npm ci`, Unit-Tests, Inhaltsvalidierung, Typecheck, Produktionsbuild und Chromium-Browsertests. Nur ein erfolgreicher Stand von `main` wird im Environment `github-pages` veroeffentlicht. Der Build hat ausschliesslich Leserechte; erst der getrennte Deploy-Job bekommt `pages: write` und `id-token: write`. Konkurrenzlaeufe werden serialisiert. Vite verwendet den Projektpfad `/grundwissen/`.

In Repository Settings → Pages muss **GitHub Actions** als Quelle eingerichtet sein. Die erwartete Adresse ist `https://danielmeixner.github.io/grundwissen/`; sie gilt erst nach bestaetigtem Deployment als veroeffentlicht. Ein privates Repository benoetigt einen GitHub-Plan, der private Pages unterstuetzt. Beim Einrichten wurde hier `422: Your current plan does not support GitHub Pages for this repository` gemeldet. Ohne passende Freigabe beziehungsweise Plan bleibt Hosting blockiert; die Repository-Sichtbarkeit wird nicht automatisch geaendert. Build- und Browserpruefungen laufen davon unabhaengig, und das gepruefte `dist/` bleibt als Actions-Artefakt verfuegbar.
