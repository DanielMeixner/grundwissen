import { useEffect, useState, useSyncExternalStore } from 'react';
import { HistoryApp } from './ui/HistoryApp';
import { scopedProgress, type Command } from './domain/engine';
import { availableBounds, eligibleQuestions, type Question } from './domain/question';
import { STORAGE_KEY, type ProgressStore } from './persistence/store';

export function App({ bank, store }: { bank: Question[]; store: ProgressStore }) {
  const { snapshot, notice } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [error, setError] = useState<string | null>(null);
  const attempt = snapshot.currentAttempt;
  const question = bank.find(question => question.id === attempt?.questionId);
  const eligible = eligibleQuestions(bank, snapshot.range);
  const progress = scopedProgress(snapshot, eligible);

  function dispatch(command: Command) {
    setError(null);
    void store.dispatch(command).catch(error => {
      setError(error instanceof Error ? error.message : String(error));
    });
  }

  useEffect(() => {
    function synchronize(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      void store.synchronize().catch(error => {
        setError(error instanceof Error ? error.message : String(error));
      });
    }
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, [store]);

  return <HistoryApp
    question={question && attempt ? {
      id: question.id,
      startYear: question.startYear,
      endYear: question.endYear,
      prompt: question.prompt,
      fact: question.fact,
      explanation: question.explanation,
      sensitivity: question.sensitivity,
      choices: attempt.choiceIds.map(id => {
        const choice = question.choices.find(choice => choice.id === id);
        if (!choice) throw new Error(`Invalid attempt choice: ${id}`);
        return { id: choice.id, text: choice.text };
      }),
      sources: question.sources.map(({ title, publisher, url }) => ({ title, publisher, url })),
    } : null}
    xp={snapshot.lifetimeXp}
    {...progress}
    totalQuestions={eligible.length}
    range={snapshot.range}
    availableYearBounds={availableBounds(bank)}
    phase={attempt?.phase ?? 'empty'}
    selectedChoiceId={attempt?.selectedChoiceId ?? null}
    correctChoiceId={attempt?.phase === 'answered' ? question?.correctChoiceId ?? null : null}
    wasCorrect={attempt?.phase === 'answered' ? attempt.wasCorrect : null}
    storageNotice={notice}
    error={error}
    onSelectChoice={choiceId => {
      if (attempt) dispatch({ type: 'select', attemptId: attempt.id, choiceId });
    }}
    onSubmit={() => {
      if (attempt?.selectedChoiceId) {
        dispatch({ type: 'answer', attemptId: attempt.id, choiceId: attempt.selectedChoiceId });
      }
    }}
    onNext={() => {
      if (attempt) dispatch({ type: 'next', attemptId: attempt.id });
    }}
    onRangeChange={range => dispatch({ type: 'range', range })}
    onResetProgress={() => dispatch({ type: 'reset' })}
  />;
}
