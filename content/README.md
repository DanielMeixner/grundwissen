# Historische Fragenbank

Der historische Bestand enthält 360 eigenständig formulierte deutschsprachige
ABCD-Fragen: je 90 zum 18., 19., 20. und 21. Jahrhundert. Die 160 bisherigen
Fragen liegen unter `questions/`; weitere 200 Ereignisfragen liegen unter
`deutschland-verstehen/` und ergänzen den Bestand mit je 50 Fragen pro Jahrhundert.
Jede Frage ergänzt den überprüfbaren Fakt durch historischen Hintergrund,
handelnde Personen oder Institutionen sowie Folgen oder Bedeutung.

Daneben liegt unter `political-literacy/` ein eigenständiger Bestand von 222 Fragen
zur politischen Bildung. Die 200 zusätzlichen Fragen ergänzen die bisherigen 22.
Der Bestand behandelt die gegenwärtige Ordnung des Bundes statt einzelner
historischer Ereignisse und gehört nicht zu den 360 Geschichtsfragen. Alle Fragen
tragen das gemeinsame Topic `Politische Bildung` und den Prüfstand 2026.

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

IDs bleiben für dieselbe Frage dauerhaft unverändert und dürfen nicht für andere
Fragen wiederverwendet werden. Eine ersetzte Frage erhält eine neue permanente ID.
`revision` bleibt im aktuellen Datenvertrag immer `1`; eine Änderung dieses Felds
setzt eine ausdrücklich beschlossene Schemaänderung voraus. Inhaltliche
Überarbeitungen erfordern eine erneute Quellenprüfung. Die Anwendung bildet
`contentRevision` aus dem gesamten Markdown-Inhalt, um Prüfkennzeichen bei Änderungen
zu erneuern, ohne bereits erworbene XP zu verlieren. Datumswerte sind zitierte
ISO-Datumszeichenketten, damit YAML-Leser sie nicht unterschiedlich als
Zeitstempelobjekte interpretieren.

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

Für die getrennte Kategorie `Politische Bildung` bezeichnen beide Jahresfelder
das Prüfjahr 2026: Es ist ein redaktioneller Stand, weder das Datum eines Ereignisses
noch eine Aussage über den gesamten Geltungszeitraum einer Rechtsnorm. Diese Fragen
sollen separat von den Geschichtsfragen gewählt und nicht als historische Ereignisse
oder anhand eines Geschichts-Zeitfilters angezeigt werden. Die Rubrik
`Historischer Fakt` enthält dort aufgrund des gemeinsamen Schemas den überprüften
Sachverhalt zur geltenden Ordnung.

## Quellenprüfung und redaktioneller Status

`reviewed` bedeutet **agentenseitig quellengeprüft**, nicht durch einen Menschen,
eine Lehrkraft oder eine wissenschaftliche Redaktion freigegeben. Die relevanten
belegenden Abschnitte der 133 unterschiedlichen Quellenseiten des ursprünglichen
Geschichtsbestands wurden am 13. November 2026 gelesen und mit den Aussagen
abgeglichen. Eine erfolgreiche HTTP-Antwort allein wurde nicht als Beleg gewertet.
Die 200 zusätzlichen Geschichtsfragen haben eigene Quellenangaben; ihr ergänzender
Prüflauf zu Zeiträumen, Sensibilität und Kontext ist noch nicht abgeschlossen.

Für die bisherigen 22 Fragen zur politischen Bildung wurden die konkret verlinkten
Artikel des Grundgesetzes und Paragraphen des Bundeswahlgesetzes am
15. November 2026 gelesen und mit den jeweiligen Aussagen abgeglichen. Die 200
zusätzlichen Politikfragen enthalten Quellenlinks; Verfügbarkeitsprüfungen waren
für einige amtliche Gesetzesseiten nicht abschließend. Der Text der Gesetze wird
durch das Bundesamt für Justiz auf Gesetze im Internet bereitgestellt. Änderungen
des Rechts erfordern eine erneute Prüfung; `reviewed` bedeutet auch hier keine
menschliche Freigabe.

| Jahrhundert | Fragen | Unterschiedliche Quellen-URLs | Beispiel für gelesene Belege |
| --- | ---: | ---: | --- |
| 18. | 90 | 49 | [Bach-Museum: Bach in Leipzig](https://www.bachinleipzig.de/de/bach-museum/ausstellung/rueckblick/), [SPSG: Schloss Sanssouci](https://www.spsg.de/presse-foto-film/pressematerial-schloesser-gaerten-stiftung/potsdam/presse-material-schloss-sanssouci/) |
| 19. | 90 | 44 | Institutionelle und wissenschaftliche Belege zu Staatenordnung, Sozialgesetzgebung, Kultur und Kolonialgeschichte |
| 20. | 90 | 56 | LeMO und ergänzende unabhängige institutionelle Belege, insbesondere für NS-Verbrechen |
| 21. | 90 | 68 | [Bundesbank: Euro-Bargeld](https://www.bundesbank.de/de/aufgaben/themen/das-euro-bargeld-wird-20--856394), [Bundestag: Eheöffnung 2017](https://www.bundestag.de/dokumente/protokolle/amtlicheprotokolle/ap18244-514228), [UNESCO: Bauhaus](https://whc.unesco.org/en/list/729) |
| Politische Bildung | 222 | 130 | [Bundesamt für Justiz: Grundgesetz, Artikel 44](https://www.gesetze-im-internet.de/gg/art_44.html), [Bundestag: Petitionsausschuss](https://www.bundestag.de/ausschuesse/a02_Petitionsausschuss) |

Bei der Erstellung des ursprünglichen Geschichtsbestands bildeten je fünf Fragen
pro Jahrhundert den 20-Fragen-Piloten. Die aktuelle Prüfung bestätigt 360
Geschichtsfragen, 90 pro Jahrhundert, 222 Politikfragen mit Prüfstand 2026,
eindeutige IDs über beide Bestände, YAML-Schlüssel, Datumsformate, Jahresgrenzen,
vier verschiedene Optionen, Antwortreferenzen und verlinkte Quellenangaben. Alle
26 aktuell mit `high` markierten Geschichtsfragen enthalten Belege von mindestens
zwei unterschiedlichen Herausgebern.

Ergänzende Abrufprüfungen konnten 130 der 133 Seiten direkt über Python/curl lesen.
Zwei Britannica-Seiten und die UNESCO-Bauhausseite waren dort zeitweise gesperrt
oder technisch nicht abrufbar; ihre belegenden Inhalte wurden über `web_fetch`
gelesen. Manche institutionellen Seiten lieferten umgekehrt bei `web_fetch` einen
403-Fehler und konnten über curl inhaltlich gelesen werden. Die online zurückgezogenen
Bundestags-Webarchivseiten für 2005–2016 wurden nicht als Quellen aufgenommen.

## Grenzen der Auswahl

Dies ist eine thematisch breite Auswahl zur deutschen Geschichte, kein vollständiger
Lehrplan und keine lückenlose Chronik. Für das 18. Jahrhundert steht die Geschichte
der deutschen Staaten und des Reichs im Mittelpunkt. Grenzüberschreitende Ereignisse
werden mit einem tatsächlichen Bezug zu dieser Geschichte behandelt, beispielsweise
Preußen und die Teilungen Polens oder die Mainzer Republik. Die zeitliche Verteilung
ist ungleichmäßig. Das 19. Jahrhundert setzt einen Schwerpunkt ab 1815; in mehreren
Jahrhunderten werden LeMO-Seiten wiederverwendet.

Die kommunale Darstellung zur Mainzer Republik verarbeitet unter anderem eine
Schülerarbeit und ist deshalb nur zusammen mit ergänzenden DHM-/bpb-Belegen
verwendet. Bei der westlichen Währungsreform 1948 fragt der Bestand bewusst
nach dem Monat Juni, nicht nach einem einzelnen Tagesdatum. Der Beleg zur Gründung
der KPM stammt aus der historischen Selbstdarstellung des Herstellers.

NS-Verbrechen, Holocaust, Kolonialismus und vergleichbare sensible Inhalte sind
sachlich und respektvoll formuliert. Quellen liefern Belege, keine pauschale
Nutzungslizenz für deren Texte oder Abbildungen; es werden keine längeren
Quellenpassagen oder Bilder übernommen. Vor einem Einsatz in Unterricht oder
Prüfungen ist eine menschliche fachliche und didaktische Freigabe sinnvoll.

## Stillgelegte IDs

Bei der Korrektur des deutschen Geschichtsbezugs wurden dreizehn Fragen vollständig
ersetzt. Ihre bisherigen IDs sind stillgelegt und dürfen nicht erneut vergeben
werden. Die Dateinamen wurden beibehalten; alle Ersatzfragen beginnen mit `revision: 1`.
Die Frage mit der ID `gw-18-021` zur polnischen Verfassung von 1791 bleibt dieselbe
Frage. Ihre Erklärung wurde um den quellenbelegten Zusammenhang mit Preußens
Ablehnung der Verfassung und seiner Beteiligung an der Teilung Polens 1793 ergänzt.

| Datei im 18. Jahrhundert | Stillgelegte ID | Neue permanente ID |
| --- | --- | --- |
| 003.md | gw-18-003 | gw-18-041 |
| 005.md | gw-18-005 | gw-18-042 |
| 023.md | gw-18-023 | gw-18-043 |
| 024.md | gw-18-024 | gw-18-044 |
| 026.md | gw-18-026 | gw-18-045 |
| 027.md | gw-18-027 | gw-18-046 |
| 028.md | gw-18-028 | gw-18-047 |
| 029.md | gw-18-029 | gw-18-048 |
| 030.md | gw-18-030 | gw-18-049 |
| 031.md | gw-18-031 | gw-18-050 |
| 032.md | gw-18-032 | gw-18-051 |
| 033.md | gw-18-033 | gw-18-052 |
| 036.md | gw-18-036 | gw-18-053 |
