# Historische Fragenbank

Der Bestand enthält 160 eigenständig formulierte deutschsprachige ABCD-Fragen:
je 40 unter `questions/18/`, `questions/19/`, `questions/20/` und `questions/21/`.
Jede Frage ergänzt den überprüfbaren Fakt durch historischen Hintergrund,
handelnde Personen oder Institutionen sowie Folgen oder Bedeutung.

## Datenvertrag

Jede Markdown-Datei steht für genau eine Frage. Ihr YAML-Kopf enthält ausschließlich:

```yaml
id: gw-21-001
revision: 1
status: reviewed
verifiedOn: "2026-11-13"
startYear: 2002
endYear: 2002
topics: [Wirtschaft, Europa]
territories: [Bundesrepublik Deutschland, Euroraum]
difficulty: 1
sensitivity: low
choices:
  - {id: a, text: "Am 1. Januar 2002"}
  - {id: b, text: "Am 1. Januar 2001"}
  - {id: c, text: "Am 1. Januar 2005"}
  - {id: d, text: "Am 1. Januar 2007"}
correctChoiceId: a
sources:
  - title: "Das Euro-Bargeld wird 20!"
    publisher: Deutsche Bundesbank
    url: https://www.bundesbank.de/de/aufgaben/themen/das-euro-bargeld-wird-20--856394
    accessed: "2026-11-13"
```

Der Text hat genau die drei Überschriften `## Frage`, `## Historischer Fakt`
und `## Erklärung`. In der Erklärung sind die im YAML genannten Quellen verlinkt.
Die vier Optionen sind eindeutig; genau eine ist als richtig referenziert.
Die ursprünglichen Antwortpositionen sind je Jahrhundert gleich verteilt:
zehnmal a, b, c und d. Die Position ist kein zusätzlicher historischer Inhalt.

IDs bleiben dauerhaft unverändert und dürfen nicht für andere Fragen wiederverwendet
werden. Inhaltliche Überarbeitungen erhöhen `revision` und erfordern eine erneute
Quellenprüfung. Datumswerte sind zitierte ISO-Datumszeichenketten, damit YAML-Leser
sie nicht unterschiedlich als Zeitstempelobjekte interpretieren.

## Zeit und räumlicher Bezug

Die Jahrhunderte umfassen 1701–1800, 1801–1900, 1901–2000 und 2001–2100.
Der aktuelle Bestand des 21. Jahrhunderts behandelt eingetretene Ereignisse
von 2001 bis 2024; redaktioneller Wissensstichtag ist der 13. November 2026.
Gesetzlich beschlossene Zukunftsziele werden als damalige Entscheidungen,
nicht als schon eingetretene Ergebnisse beschrieben.

`startYear` und `endYear` beziehen sich auf den abgefragten historischen Fakt.
Der erklärende Hintergrund kann weitere Zeiträume nennen. Bei eigenen Zeitfiltern
ist eine Überschneidung zu verwenden: `startYear <= bis && endYear >= von`.
Vor 1871 werden die betreffenden historischen Staaten oder Territorien benannt;
es wird kein bereits bestehender deutscher Nationalstaat vorausgesetzt.

## Quellenprüfung und redaktioneller Status

`reviewed` bedeutet **agentenseitig quellengeprüft**, nicht durch einen Menschen,
eine Lehrkraft oder eine wissenschaftliche Redaktion freigegeben. Die relevanten
belegenden Abschnitte der insgesamt 130 unterschiedlichen angegebenen Quellenseiten
wurden am 13. November 2026 gelesen und mit den Aussagen abgeglichen.
Eine erfolgreiche HTTP-Antwort allein wurde nicht als Beleg gewertet.

| Jahrhundert | Fragen | Unterschiedliche Quellen-URLs | Beispiel für gelesene Belege |
| --- | ---: | ---: | --- |
| 18. | 40 | 27 | [DHM: Rückblick Februar 2013](https://www.dhm.de/lemo/rueckblick/lemo-rueckblick-februar-2013), [Universität Göttingen](https://www5.uni-goettingen.de/de/62600.html) |
| 19. | 40 | 36 | Institutionelle und wissenschaftliche Belege zu Staatenordnung, Sozialgesetzgebung, Kultur und Kolonialgeschichte |
| 20. | 40 | 45 | LeMO und ergänzende unabhängige institutionelle Belege, insbesondere für NS-Verbrechen |
| 21. | 40 | 22 | [Bundesbank: Euro-Bargeld](https://www.bundesbank.de/de/aufgaben/themen/das-euro-bargeld-wird-20--856394), [Bundestag: Eheöffnung 2017](https://www.bundestag.de/dokumente/protokolle/amtlicheprotokolle/ap18244-514228), [UNESCO: Bauhaus](https://whc.unesco.org/en/list/729) |

Die ersten fünf Fragen jedes Jahrhunderts bildeten den 20-Fragen-Piloten.
Pilotfragen und anschließend der vollständige Bestand wurden gegen den Datenvertrag
geprüft. Die Gesamtprüfung bestätigte Anzahl, eindeutige IDs und Fragetexte,
YAML-Schlüssel, Datumsformate, Jahresgrenzen, vier verschiedene Optionen,
Antwortreferenzen, Quellenfelder und Quellenzitate. Alle 18 mit `high` markierten
Fragen enthalten Belege von mindestens zwei unterschiedlichen Herausgebern.

Ergänzende Abrufprüfungen konnten 127 der 130 Seiten direkt über Python/curl lesen.
Zwei Britannica-Seiten und die UNESCO-Bauhausseite waren dort zeitweise gesperrt
oder technisch nicht abrufbar; ihre belegenden Inhalte wurden über `web_fetch`
gelesen. Manche institutionellen Seiten lieferten umgekehrt bei `web_fetch` einen
403-Fehler und konnten über curl inhaltlich gelesen werden. Die online zurückgezogenen
Bundestags-Webarchivseiten für 2005–2016 wurden nicht als Quellen aufgenommen.

## Grenzen der Auswahl

Dies ist eine thematisch breite Auswahl, kein vollständiger Lehrplan und keine
lückenlose Chronik. Das 18. Jahrhundert enthält 26 Fragen zum deutschen Staaten-
oder Reichskontext, drei zum polnischen beziehungsweise grenzüberschreitenden
Kontext und elf weitere internationale beziehungsweise atlantische Fragen.
Die zeitliche Verteilung ist ungleichmäßig. Das 19. Jahrhundert setzt einen
Schwerpunkt ab 1815; in mehreren Jahrhunderten werden LeMO-Seiten wiederverwendet.

Die kommunale Darstellung zur Mainzer Republik verarbeitet unter anderem eine
Schülerarbeit und ist deshalb nur zusammen mit ergänzenden DHM-/bpb-Belegen
verwendet. Bei der westlichen Währungsreform 1948 fragt der Bestand bewusst
nach dem Monat Juni, nicht nach einem einzelnen Tagesdatum.

NS-Verbrechen, Holocaust, Kolonialismus und vergleichbare sensible Inhalte sind
sachlich und respektvoll formuliert. Quellen liefern Belege, keine pauschale
Nutzungslizenz für deren Texte oder Abbildungen; es werden keine längeren
Quellenpassagen oder Bilder übernommen. Vor einem Einsatz in Unterricht oder
Prüfungen ist eine menschliche fachliche und didaktische Freigabe sinnvoll.
