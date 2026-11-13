import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import './history.css';

export interface YearRange {
  startYear: number;
  endYear: number;
}

export interface HistoryChoice {
  id: string;
  text: string;
}

export interface HistorySource {
  title: string;
  publisher: string;
  url: string;
}

export interface HistoryQuestion {
  id: string;
  startYear: number;
  endYear: number;
  prompt: string;
  fact: string;
  explanation: string;
  sensitivity: string;
  choices: HistoryChoice[];
  sources: HistorySource[];
}

export interface HistoryAppProps {
  question: HistoryQuestion | null;
  xp: number;
  attemptedCount: number;
  latestCorrectCount: number;
  totalQuestions: number;
  range: YearRange;
  availableYearBounds: YearRange;
  phase: 'asking' | 'answered' | 'empty';
  selectedChoiceId: string | null;
  correctChoiceId: string | null;
  wasCorrect: boolean | null;
  storageNotice: string | null;
  error: string | null;
  onSelectChoice: (id: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  onRangeChange: (range: YearRange) => void;
  onResetProgress: () => void;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE').format(value);
}

function yearLabel(range: YearRange) {
  return range.startYear === range.endYear
    ? `${range.startYear}`
    : `${range.startYear}–${range.endYear}`;
}

function useTheme() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const param = new URLSearchParams(window.location.search).get('scoutTheme');
      const theme = param || (media.matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
}

interface RangeFilterProps {
  range: YearRange;
  bounds: YearRange;
  onApply: (range: YearRange) => void;
}

function RangeFilter({ range, bounds, onApply }: RangeFilterProps) {
  const id = useId();
  const [start, setStart] = useState(`${range.startYear}`);
  const [end, setEnd] = useState(`${range.endYear}`);
  const [validation, setValidation] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    setStart(`${range.startYear}`);
    setEnd(`${range.endYear}`);
    setValidation(null);
  }, [range.startYear, range.endYear]);
  useEffect(() => {
    if (validation) errorRef.current?.focus();
  }, [validation]);

  const presets = [
    { label: '18. Jahrhundert', startYear: 1701, endYear: 1800 },
    { label: '19. Jahrhundert', startYear: 1801, endYear: 1900 },
    { label: '20. Jahrhundert', startYear: 1901, endYear: 2000 },
    { label: '21. Jahrhundert', startYear: 2001, endYear: bounds.endYear },
  ];
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const startYear = Number(start);
    const endYear = Number(end);
    if (!/^-?\d+$/.test(start) || !/^-?\d+$/.test(end)
      || !Number.isSafeInteger(startYear) || !Number.isSafeInteger(endYear)) {
      setValidation('Bitte gib zwei ganze Jahreszahlen ein.');
      return;
    }
    if (startYear > endYear) {
      setValidation('Das Anfangsjahr muss vor oder im selben Jahr wie das Endjahr liegen.');
      return;
    }
    if (startYear < bounds.startYear || endYear > bounds.endYear) {
      setValidation(`Bitte bleibe im verfügbaren Zeitraum ${yearLabel(bounds)}.`);
      return;
    }
    setValidation(null);
    onApply({ startYear, endYear });
  };

  return (
    <section id="history-time-filter" tabIndex={-1} className="history-panel history-filter" aria-labelledby={`${id}-title`}>
      <div className="history-section-heading">
        <span className="history-eyebrow">Dein Zeitfenster</span>
        <h2 id={`${id}-title`}>Geschichte eingrenzen</h2>
      </div>
      <p>Aktiv: <strong>{yearLabel(range)}</strong>. Beide Grenzjahre zählen mit.</p>
      <form onSubmit={apply} noValidate>
        <fieldset className="history-presets">
          <legend>Jahrhundert als Vorschlag wählen</legend>
          {presets.map((preset) => {
            const clipped = {
              startYear: Math.max(preset.startYear, bounds.startYear),
              endYear: Math.min(preset.endYear, bounds.endYear),
            };
            const unavailable = clipped.startYear > clipped.endYear;
            const selected = start === `${clipped.startYear}` && end === `${clipped.endYear}`;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={selected}
                disabled={unavailable}
                onClick={() => {
                  setStart(`${clipped.startYear}`);
                  setEnd(`${clipped.endYear}`);
                  setValidation(null);
                }}
              >
                <span>{preset.label}</span>
                <small>{unavailable ? 'Nicht verfügbar' : yearLabel(clipped)}</small>
              </button>
            );
          })}
        </fieldset>
        <div className="history-year-inputs">
          <label htmlFor={`${id}-start`}>Von Jahr
            <input
              id={`${id}-start`} type="number" step="1"
              min={bounds.startYear} max={bounds.endYear}
              value={start} onChange={(event) => setStart(event.target.value)}
              aria-invalid={Boolean(validation)} aria-describedby={`${id}-help${validation ? ` ${id}-error` : ''}`}
            />
          </label>
          <label htmlFor={`${id}-end`}>Bis Jahr
            <input
              id={`${id}-end`} type="number" step="1"
              min={bounds.startYear} max={bounds.endYear}
              value={end} onChange={(event) => setEnd(event.target.value)}
              aria-invalid={Boolean(validation)} aria-describedby={`${id}-help${validation ? ` ${id}-error` : ''}`}
            />
          </label>
        </div>
        <p id={`${id}-help`} className="history-small">
          Verfügbar: {yearLabel(bounds)}. Änderungen werden erst mit „Filter anwenden“ aktiv.
        </p>
        {validation && (
          <p id={`${id}-error`} className="history-inline-error" role="alert" tabIndex={-1} ref={errorRef}>
            {validation}
          </p>
        )}
        <button className="history-button history-button-secondary history-full-width" type="submit">
          Filter anwenden <span aria-hidden="true">→</span>
        </button>
      </form>
    </section>
  );
}

function Journey({ xp }: { xp: number }) {
  const currentMilestone = Math.floor(xp / 100);
  const firstMilestone = Math.max(0, currentMilestone - 1);
  const milestones = Array.from({ length: 5 }, (_, index) => firstMilestone + index);
  const nextMilestone = (currentMilestone + 1) * 100;
  return (
    <section className="history-panel history-journey" aria-labelledby="history-journey-title">
      <div className="history-section-heading">
        <span className="history-eyebrow">Schritt für Schritt</span>
        <h2 id="history-journey-title">Deine Lernreise</h2>
      </div>
      <p>Kein Zielstrich. Mit deiner Übung wächst der Weg weiter.</p>
      <ol className="history-path" aria-label="Meilensteine in Schritten von 100 XP">
        {milestones.map((milestone, index) => {
          const reached = milestone * 100 <= xp;
          const current = milestone === currentMilestone;
          return (
            <li key={milestone} className={`history-path-stop history-path-position-${index % 3}${reached ? ' is-reached' : ''}${current ? ' is-current' : ''}`}
              aria-current={current ? 'step' : undefined}>
              <span className="history-path-node" aria-hidden="true">{reached ? '✓' : '·'}</span>
              <span className="history-path-caption">
                <strong>{formatNumber(milestone * 100)} XP</strong>
                <small>{current ? 'Hier bist du' : reached ? 'Erreicht' : 'Nächster Meilenstein'}</small>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="history-next-milestone">
        <div><strong>{formatNumber(nextMilestone - xp)} XP</strong><span> bis zum nächsten Meilenstein</span></div>
        <progress value={xp - currentMilestone * 100} max={100}
          aria-label={`Fortschritt zum Meilenstein ${nextMilestone} XP`} />
      </div>
      <p className="history-small">XP zeigen Übung, nicht die sichere Beherrschung eines Themas.</p>
    </section>
  );
}

function QuestionCard(props: HistoryAppProps & { question: HistoryQuestion }) {
  const { question, phase, selectedChoiceId, correctChoiceId, wasCorrect, onSelectChoice, onSubmit, onNext } = props;
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLHeadingElement>(null);
  const factRef = useRef<HTMLHeadingElement>(null);
  const answered = phase === 'answered';
  const showingExplanation = answered && revealed;
  const sensitive = !['', 'none', 'normal', 'low', 'niedrig', 'standard'].includes(question.sensitivity.toLowerCase());
  const correctAnswer = question.choices.find((choice) => choice.id === correctChoiceId);

  useEffect(() => {
    if (!answered) {
      setRevealed(false);
      titleRef.current?.focus();
    }
  }, [question.id, answered]);
  useEffect(() => {
    if (answered) feedbackRef.current?.focus();
  }, [answered]);
  useEffect(() => {
    if (revealed) factRef.current?.focus();
  }, [revealed]);

  return (
    <section className={`history-panel history-question${sensitive ? ' history-sensitive' : ''}`}
      aria-labelledby={`${id}-question`}>
      <div className="history-card-meta">
        <span className="history-eyebrow">{showingExplanation ? 'Die Geschichte dahinter' : 'Eine Frage, ein neuer Blick'}</span>
        <span className="history-year-tag">{yearLabel(question)}</span>
      </div>
      {sensitive && (
        <p className="history-sensitivity">
          Sensibles Thema. Wir betrachten diese Geschichte sachlich und mit Respekt für die Betroffenen.
        </p>
      )}
      <h2 id={`${id}-question`} ref={titleRef} tabIndex={-1} className="history-question-title">
        {question.prompt}
      </h2>
      {!showingExplanation ? (
        <>
          <form onSubmit={(event) => { event.preventDefault(); if (!answered && selectedChoiceId !== null) onSubmit(); }}>
            <fieldset className="history-choices" disabled={answered}>
              <legend>{answered ? 'Deine abgegebene Antwort' : 'Wähle eine Antwort'}</legend>
              {question.choices.map((choice, index) => {
                const selected = choice.id === selectedChoiceId;
                const correct = answered && choice.id === correctChoiceId;
                const wrong = answered && selected && wasCorrect === false;
                return (
                  <label key={choice.id}
                    className={`history-choice${selected ? ' is-selected' : ''}${correct ? ' is-correct' : ''}${wrong ? ' is-wrong' : ''}`}>
                    <input type="radio" name={`${id}-answer`} value={choice.id}
                      checked={selected} onChange={() => onSelectChoice(choice.id)} />
                    <span className="history-choice-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                    <span className="history-choice-text">{choice.text}
                      {correct && <small>Richtige Antwort</small>}
                      {wrong && <small>Deine Antwort · nicht richtig</small>}
                      {answered && selected && !wrong && <small>Deine Antwort</small>}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {!answered && (
              <div className="history-question-actions">
                <span className="history-small">In deinem Tempo. Ohne Zeitlimit.</span>
                <button className="history-button history-button-primary" type="submit" disabled={selectedChoiceId === null}>
                  Antwort prüfen <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </form>
        </>
      ) : (
        <div className="history-backside">
          <span className="history-eyebrow">Historischer Fakt</span>
          <h3 tabIndex={-1} ref={factRef}>Wissen mit Zusammenhang</h3>
          <p className="history-fact">{question.fact}</p>
          <h4>Einordnung</h4>
          <p className="history-context">{question.explanation}</p>
          <h4>Quellen zum Weiterlesen</h4>
          <ul className="history-sources">
            {question.sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}
                  <span className="history-visually-hidden"> (öffnet in einem neuen Tab)</span>
                  <span aria-hidden="true"> ↗</span>
                </a>
                <span>{source.publisher}</span>
              </li>
            ))}
          </ul>
          {question.sources.length === 0 && <p>Für diese Frage sind keine Quellen hinterlegt.</p>}
        </div>
      )}
      {answered && (
        <>
          <div className={`history-feedback${wasCorrect === false ? ' is-wrong' : ''}`} role="status" aria-live="polite">
            <h3 ref={feedbackRef} tabIndex={-1}>
              {wasCorrect === true ? 'Richtig beantwortet.' : wasCorrect === false ? 'Noch nicht richtig.' : 'Antwort abgegeben.'}
            </h3>
            <p>{correctAnswer ? <>Die richtige Antwort ist: <strong>{correctAnswer.text}</strong>.</> : 'Die richtige Antwort ist derzeit nicht verfügbar.'}</p>
          </div>
          <div className="history-question-actions history-answer-actions">
            <button type="button" className="history-button history-button-secondary"
              aria-expanded={showingExplanation} onClick={() => setRevealed(!revealed)}>
              {showingExplanation ? 'Zur Antwortseite' : 'Fakt & Einordnung ansehen'}
            </button>
            <button type="button" className="history-button history-button-primary" onClick={onNext}>
              Nächste Frage <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function LocalProgress({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  function cancel() {
    setConfirming(false);
    resetRef.current?.focus();
  }
  return (
    <section className="history-local" aria-labelledby="history-local-title">
      <div>
        <h2 id="history-local-title">Dein Fortschritt bleibt in diesem Browser</h2>
        <p>Kein Konto, keine Synchronisierung. Wenn du Browserdaten löschst, kann dein Fortschritt verloren gehen.
          Eine Anmeldung ist noch nicht verfügbar. Gelöschte Daten lassen sich hier nicht wiederherstellen.</p>
      </div>
      <button ref={resetRef} type="button" className="history-button history-button-quiet"
        onClick={() => setConfirming(true)} aria-expanded={confirming}>Fortschritt zurücksetzen</button>
      {confirming && (
        <section className="history-reset-confirm" aria-label="Zurücksetzen bestätigen">
          <h3>Lokalen Lernfortschritt wirklich löschen?</h3>
          <p>Alle gespeicherten Antworten und XP in diesem Browser werden gelöscht. Das kann nicht rückgängig gemacht werden.</p>
          <div className="history-confirm-actions">
            <button type="button" className="history-button history-button-secondary" onClick={cancel}>Abbrechen</button>
            <button ref={confirmRef} type="button" className="history-button history-button-primary"
              onClick={() => {
                onReset();
                setConfirming(false);
                resetRef.current?.focus();
              }}>Ja, Fortschritt löschen</button>
          </div>
        </section>
      )}
    </section>
  );
}

export function HistoryApp(props: HistoryAppProps) {
  useTheme();
  const { xp, attemptedCount, latestCorrectCount, totalQuestions, range, availableYearBounds, question, storageNotice, error } = props;
  return (
    <div className="history-app">
      <a className="history-skip-link" href="#history-practice">Zur aktuellen Frage</a>
      <header className="history-header">
        <a className="history-brand" href="#history-main" aria-label="Grundwissen · zum Hauptinhalt">
          <span className="history-brand-mark" aria-hidden="true">g<span>·</span></span>
          <span>grundwissen<small>Geschichte verstehen.</small></span>
        </a>
        <span className="history-header-note">Wissen wächst mit jeder Frage.</span>
        <div className="history-xp-pill"><span aria-hidden="true">✦</span> {formatNumber(xp)} XP</div>
      </header>
      <main id="history-main" className="history-main">
        <section className="history-intro" aria-labelledby="history-page-title">
          <div>
            <span className="history-eyebrow">Deutsche Geschichte · ab 1701</span>
            <h1 id="history-page-title">Ein Blick zurück.<br /><span>Ein Schritt nach vorn.</span></h1>
            <p>Entdecke Zusammenhänge statt nur Jahreszahlen. Eine Frage nach der anderen, in deinem eigenen Tempo.</p>
          </div>
          <div className="history-intro-detail" aria-hidden="true">
            <span>VERSTEHEN</span><div className="history-line-art"><i /><i /><i /><i /></div><span>WEITERDENKEN</span>
          </div>
        </section>
        {storageNotice && <div className="history-notice" role="status"><strong>Lokaler Speicher</strong><p>{storageNotice}</p></div>}
        {error && <div className="history-notice history-error" role="alert"><strong>Etwas ist schiefgegangen</strong><p>{error}</p></div>}
        <section className="history-stats" aria-label={`Dein Überblick für ${yearLabel(range)}`}>
          <div><span className="history-stat-value">{formatNumber(xp)} <small>XP</small></span><span>Übung insgesamt</span></div>
          <div><span className="history-stat-value">{formatNumber(attemptedCount)} <small>/ {formatNumber(totalQuestions)}</small></span><span>Verschiedene Fragen beantwortet</span></div>
          <div><span className="history-stat-value">{formatNumber(latestCorrectCount)}</span><span>Zuletzt richtig beantwortet</span></div>
          <p>Fragenzahlen gelten für {yearLabel(range)}. „Zuletzt richtig“ beschreibt die letzte Antwort je Frage, keine dauerhafte Beherrschung.</p>
        </section>
        <div className="history-layout">
          <aside className="history-sidebar">
            <RangeFilter range={range} bounds={availableYearBounds} onApply={props.onRangeChange} />
            <Journey xp={xp} />
          </aside>
          <div id="history-practice" className="history-practice" tabIndex={-1}>
            <div className="history-practice-heading">
              <h2>Dein nächster Gedankenschritt</h2>
              <span>{yearLabel(range)}</span>
            </div>
            {question && props.phase !== 'empty' ? (
              <QuestionCard key={`${question.id}-${question.choices.map((choice) => choice.id).join('-')}`} {...props} question={question} />
            ) : (
              <section className="history-panel history-empty" aria-labelledby="history-empty-title">
                <span className="history-empty-symbol" aria-hidden="true">⌕</span>
                <h2 id="history-empty-title">{error ? 'Die Frage konnte nicht geladen werden.' : 'Hier gibt es gerade keine Frage.'}</h2>
                <p>{error ? 'Beachte die Fehlermeldung oben. Du kannst den Zeitraum bewusst neu anwenden.' : `Für ${yearLabel(range)} ist keine Frage verfügbar. Wähle einen anderen Zeitraum und wende den Filter an.`}</p>
                <a className="history-button history-button-secondary" href="#history-time-filter">Zum Zeitfilter</a>
              </section>
            )}
            <div className="history-learning-note">
              <span aria-hidden="true">↳</span>
              <p><strong>Mehr als richtig oder falsch.</strong> Nach jeder Antwort findest du den historischen Fakt,
                seine Einordnung und Quellen zum Weiterlesen – auch wenn du richtig liegst.</p>
            </div>
          </div>
        </div>
        <LocalProgress onReset={props.onResetProgress} />
      </main>
      <footer className="history-footer"><span>grundwissen · Eine offene Lernreise</span><span>Keine Uhr. Keine Leben. Kein Endspiel.</span></footer>
    </div>
  );
}
