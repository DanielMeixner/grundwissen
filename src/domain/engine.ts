import { z } from 'zod';
import { availableBounds, eligibleQuestions, type Question, type Range } from './question';

export const SCORING_POLICY = 'correct-10-v1' as const;
const nonnegative = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const revision = z.string().min(1);
const latestSchema = z.object({
  contentRevision: revision,
  correct: z.boolean(),
  attemptId: z.uuid(),
}).strict();
const aggregateSchema = z.object({
  attempts: nonnegative,
  correctAttempts: nonnegative,
  latest: latestSchema,
}).strict().refine(value => value.attempts > 0 && value.correctAttempts <= value.attempts,
  'Invalid attempt counts');
const attemptSchema = z.object({
  id: z.uuid(),
  questionId: revision,
  contentRevision: revision,
  choiceIds: z.array(z.string().min(1)).length(4),
  selectedChoiceId: z.string().nullable(),
  phase: z.enum(['asking', 'answered']),
  wasCorrect: z.boolean().nullable(),
  awardedXp: z.union([z.literal(0), z.literal(10)]),
}).strict().superRefine((attempt, ctx) => {
  if (new Set(attempt.choiceIds).size !== 4 ||
      (attempt.selectedChoiceId !== null && !attempt.choiceIds.includes(attempt.selectedChoiceId))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid stored choice order or selection' });
  }
  if (attempt.phase === 'asking' && (attempt.wasCorrect !== null || attempt.awardedXp !== 0)) {
    ctx.addIssue({ code: 'custom', message: 'Unanswered attempt cannot have a reward' });
  }
  if (attempt.phase === 'answered' && (attempt.selectedChoiceId === null || attempt.wasCorrect === null ||
      attempt.awardedXp !== (attempt.wasCorrect ? 10 : 0))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid answered attempt' });
  }
});
const snapshotFields = {
  profileId: z.uuid(),
  revision: nonnegative,
  lifetimeXp: nonnegative.refine(value => value % 10 === 0, 'Invalid XP total'),
  progress: z.record(z.string(), aggregateSchema),
  range: z.object({
    startYear: z.number().int().min(1).max(9999),
    endYear: z.number().int().min(1).max(9999),
  }).strict().refine(value => value.startYear <= value.endYear, 'Invalid stored range'),
  queue: z.array(z.string().min(1)).refine(value => new Set(value).size === value.length, 'Duplicate queue IDs'),
  currentAttempt: attemptSchema.nullable(),
  lastQuestionId: z.string().nullable(),
  history: z.array(z.object({
    attemptId: z.uuid(),
    questionId: revision,
    contentRevision: revision,
    correct: z.boolean(),
  }).strict()).max(100),
};
export const snapshotSchema = z.object({
  ...snapshotFields,
  version: z.literal(2),
  scoringPolicy: z.literal(SCORING_POLICY),
}).strict().superRefine((snapshot, ctx) => {
  const total = Object.values(snapshot.progress).reduce((sum, entry) => sum + entry.correctAttempts * 10, 0);
  if (total !== snapshot.lifetimeXp) ctx.addIssue({ code: 'custom', message: 'XP and aggregates disagree' });
  if (new Set(snapshot.history.map(entry => entry.attemptId)).size !== snapshot.history.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate attempt history' });
  }
  const attempt = snapshot.currentAttempt;
  if (attempt?.phase === 'answered') {
    const latest = snapshot.progress[attempt.questionId]?.latest;
    if (!latest || latest.attemptId !== attempt.id || latest.correct !== attempt.wasCorrect ||
        latest.contentRevision !== attempt.contentRevision) {
      ctx.addIssue({ code: 'custom', message: 'Feedback and saved progress disagree' });
    }
  }
});
const versionOneSchema = z.object({ ...snapshotFields, version: z.literal(1) }).strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Attempt = NonNullable<Snapshot['currentAttempt']>;
export type Random = () => number;
export type EngineEnvironment = { random: Random; uuid: () => string };
export const browserEnvironment: EngineEnvironment = {
  random: () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
  uuid: () => crypto.randomUUID(),
};

export function decodeSnapshot(raw: string): Snapshot {
  const value: unknown = JSON.parse(raw);
  if (typeof value === 'object' && value !== null && 'version' in value && value.version === 1) {
    const old = versionOneSchema.parse(value);
    return snapshotSchema.parse({ ...old, version: 2, scoringPolicy: SCORING_POLICY });
  }
  return snapshotSchema.parse(value);
}

export function shuffled<T>(values: readonly T[], random: Random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function scheduleRound(
  questions: Question[], progress: Snapshot['progress'], previous: string | null, random: Random,
): string[] {
  const groups: string[][] = [[], [], []];
  for (const question of questions) {
    const latest = progress[question.id]?.latest;
    const group = !latest || latest.contentRevision !== question.contentRevision ? 0 : latest.correct ? 2 : 1;
    groups[group].push(question.id);
  }
  const queue = groups.flatMap(group => shuffled(group, random));
  // Boundary-repeat avoidance takes precedence over group priority for the first item only.
  if (queue.length > 1 && queue[0] === previous) [queue[0], queue[1]] = [queue[1], queue[0]];
  return queue;
}

function startNext(snapshot: Snapshot, bank: Question[], env: EngineEnvironment): Snapshot {
  const questions = eligibleQuestions(bank, snapshot.range);
  if (!questions.length) return { ...snapshot, queue: [], currentAttempt: null };
  const queue = snapshot.queue.length ? [...snapshot.queue] :
    scheduleRound(questions, snapshot.progress, snapshot.lastQuestionId, env.random);
  const questionId = queue.shift();
  const question = questions.find(question => question.id === questionId);
  if (!question) throw new Error('Question queue contains an unavailable question');
  return {
    ...snapshot,
    queue,
    currentAttempt: {
      id: env.uuid(),
      questionId: question.id,
      contentRevision: question.contentRevision,
      choiceIds: shuffled(question.choices.map(choice => choice.id), env.random),
      selectedChoiceId: null,
      phase: 'asking',
      wasCorrect: null,
      awardedXp: 0,
    },
  };
}

export function freshSnapshot(bank: Question[], env = browserEnvironment): Snapshot {
  return startNext({
    version: 2,
    scoringPolicy: SCORING_POLICY,
    profileId: env.uuid(),
    revision: 0,
    lifetimeXp: 0,
    progress: {},
    range: availableBounds(bank),
    queue: [],
    currentAttempt: null,
    lastQuestionId: null,
    history: [],
  }, bank, env);
}

export function reconcileSnapshot(snapshot: Snapshot, bank: Question[], env = browserEnvironment): Snapshot {
  const questions = eligibleQuestions(bank, snapshot.range);
  const ids = new Set(questions.map(question => question.id));
  const queue = snapshot.queue.filter(id => ids.has(id));
  const attempt = snapshot.currentAttempt;
  const question = questions.find(question => question.id === attempt?.questionId);
  if (attempt && question && question.contentRevision === attempt.contentRevision &&
      attempt.choiceIds.every(id => question.choices.some(choice => choice.id === id))) {
    return { ...snapshot, queue: queue.filter(id => id !== attempt.questionId) };
  }
  return startNext({ ...snapshot, queue: [], currentAttempt: null }, bank, env);
}

export type Command =
  | { type: 'select'; attemptId: string; choiceId: string }
  | { type: 'answer'; attemptId: string; choiceId: string }
  | { type: 'next'; attemptId: string }
  | { type: 'range'; range: Range }
  | { type: 'reset' };

export function transition(
  snapshot: Snapshot, command: Command, bank: Question[], env = browserEnvironment,
): Snapshot {
  if (command.type === 'reset') return freshSnapshot(bank, env);
  if (command.type === 'range') {
    eligibleQuestions(bank, command.range);
    return startNext({ ...snapshot, range: command.range, queue: [], currentAttempt: null }, bank, env);
  }
  const attempt = snapshot.currentAttempt;
  if (!attempt || attempt.id !== command.attemptId) return snapshot;
  if (command.type === 'next') {
    if (attempt.phase !== 'answered') return snapshot;
    return startNext({ ...snapshot, lastQuestionId: attempt.questionId, currentAttempt: null }, bank, env);
  }
  if (attempt.phase !== 'asking' || !attempt.choiceIds.includes(command.choiceId)) return snapshot;
  if (command.type === 'select') {
    return { ...snapshot, currentAttempt: { ...attempt, selectedChoiceId: command.choiceId } };
  }
  const question = bank.find(question => question.id === attempt.questionId);
  if (!question || question.contentRevision !== attempt.contentRevision) throw new Error('Attempt content has changed');
  const correct = question.correctChoiceId === command.choiceId;
  const previous = snapshot.progress[question.id];
  if (snapshot.lifetimeXp > Number.MAX_SAFE_INTEGER - 10 ||
      (previous?.attempts ?? 0) >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Der Fortschritt hat seine maximal speicherbare Groesse erreicht.');
  }
  const next: Snapshot = {
    ...snapshot,
    lifetimeXp: snapshot.lifetimeXp + (correct ? 10 : 0),
    currentAttempt: {
      ...attempt, selectedChoiceId: command.choiceId, phase: 'answered',
      wasCorrect: correct, awardedXp: correct ? 10 : 0,
    },
    progress: {
      ...snapshot.progress,
      [question.id]: {
        attempts: (previous?.attempts ?? 0) + 1,
        correctAttempts: (previous?.correctAttempts ?? 0) + (correct ? 1 : 0),
        latest: { contentRevision: question.contentRevision, correct, attemptId: attempt.id },
      },
    },
    history: [...snapshot.history, {
      attemptId: attempt.id, questionId: question.id, contentRevision: question.contentRevision, correct,
    }].slice(-100),
  };
  return snapshotSchema.parse(next);
}

export function scopedProgress(snapshot: Snapshot, questions: Question[]) {
  let attemptedCount = 0;
  let latestCorrectCount = 0;
  for (const question of questions) {
    const latest = snapshot.progress[question.id]?.latest;
    if (latest?.contentRevision === question.contentRevision) {
      attemptedCount++;
      if (latest.correct) latestCorrectCount++;
    }
  }
  return { attemptedCount, latestCorrectCount };
}
