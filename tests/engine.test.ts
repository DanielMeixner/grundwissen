import { describe, expect, it } from 'vitest';
import {
  decodeSnapshot, freshSnapshot, reconcileSnapshot, scheduleRound, scopedProgress, transition,
  type Snapshot,
} from '../src/domain/engine';
import { eligibleQuestions } from '../src/domain/question';
import { environment, questions } from './fixtures';

describe('range and round scheduler', () => {
  it('uses exact inclusive interval overlap without broadening', () => {
    const bank = questions();
    expect(eligibleQuestions(bank, { startYear: 1702, endYear: 1702 }).map(q => q.id)).toEqual(['q0']);
    expect(eligibleQuestions(bank, { startYear: 1750, endYear: 1799 })).toEqual([]);
    for (const range of [
      { startYear: 1800, endYear: 1700 }, { startYear: 1701.5, endYear: 1800 },
      { startYear: NaN, endYear: 1800 },
    ]) expect(() => eligibleQuestions(bank, range)).toThrow();
  });
  it('prioritizes unseen, last-wrong, last-right and shuffles without replacement', () => {
    const bank = questions(6);
    const env = environment();
    const snapshot = freshSnapshot(bank, env);
    snapshot.progress = {
      q2: { attempts: 1, correctAttempts: 0, latest: { contentRevision: bank[2].contentRevision, correct: false, attemptId: env.uuid() } },
      q3: { attempts: 1, correctAttempts: 1, latest: { contentRevision: bank[3].contentRevision, correct: true, attemptId: env.uuid() } },
      q4: { attempts: 1, correctAttempts: 0, latest: { contentRevision: bank[4].contentRevision, correct: false, attemptId: env.uuid() } },
      q5: { attempts: 1, correctAttempts: 1, latest: { contentRevision: bank[5].contentRevision, correct: true, attemptId: env.uuid() } },
    };
    const queue = scheduleRound(bank, snapshot.progress, null, env.random);
    expect(queue.slice(0, 2).sort()).toEqual(['q0', 'q1']);
    expect(queue.slice(2, 4).sort()).toEqual(['q2', 'q4']);
    expect(queue.slice(4).sort()).toEqual(['q3', 'q5']);
    expect(new Set(queue).size).toBe(6);
    expect(scheduleRound(bank, snapshot.progress, queue[0], env.random)[0]).not.toBe(queue[0]);
  });
  it('plays every question once each round and never repeats at the boundary', () => {
    const bank = questions();
    const env = environment();
    let snapshot = freshSnapshot(bank, env);
    const played: string[] = [];
    for (let index = 0; index < 16; index++) {
      const attempt = snapshot.currentAttempt!;
      played.push(attempt.questionId);
      snapshot = transition(snapshot, { type: 'answer', attemptId: attempt.id, choiceId: 'b' }, bank, env);
      snapshot = transition(snapshot, { type: 'next', attemptId: attempt.id }, bank, env);
    }
    for (let round = 0; round < 4; round++) {
      expect(new Set(played.slice(round * 4, round * 4 + 4)).size).toBe(4);
      if (round) expect(played[round * 4]).not.toBe(played[round * 4 - 1]);
    }
  });
});

describe('explicit attempt scoring', () => {
  it('locks each answer, restores feedback/order on reload and rewards every new repeated attempt', () => {
    const bank = questions(1);
    const env = environment();
    let snapshot = freshSnapshot(bank, env);
    const attempt = snapshot.currentAttempt!;
    snapshot = transition(snapshot, { type: 'select', attemptId: attempt.id, choiceId: 'a' }, bank, env);
    expect(snapshot.lifetimeXp).toBe(0);
    snapshot = transition(snapshot, { type: 'answer', attemptId: attempt.id, choiceId: 'a' }, bank, env);
    const answered = snapshot;
    snapshot = transition(snapshot, { type: 'answer', attemptId: attempt.id, choiceId: 'b' }, bank, env);
    expect(snapshot).toBe(answered);
    snapshot = reconcileSnapshot(decodeSnapshot(JSON.stringify(snapshot)), bank, env);
    expect(snapshot.currentAttempt).toEqual(answered.currentAttempt);
    expect(snapshot.lifetimeXp).toBe(10);
    snapshot = transition(snapshot, { type: 'next', attemptId: attempt.id }, bank, env);
    expect(snapshot.currentAttempt!.id).not.toBe(attempt.id);
    expect(snapshot.currentAttempt!.questionId).toBe(attempt.questionId);
    snapshot = transition(snapshot, { type: 'answer', attemptId: snapshot.currentAttempt!.id, choiceId: 'a' }, bank, env);
    expect(snapshot.lifetimeXp).toBe(20);
    expect(scopedProgress(snapshot, bank)).toEqual({ attemptedCount: 1, latestCorrectCount: 1 });
  });
  it('does not allow next before answer or invalid/stale submissions', () => {
    const bank = questions();
    const env = environment();
    const snapshot = freshSnapshot(bank, env);
    expect(transition(snapshot, { type: 'next', attemptId: snapshot.currentAttempt!.id }, bank, env)).toBe(snapshot);
    expect(transition(snapshot, { type: 'answer', attemptId: 'stale', choiceId: 'a' }, bank, env)).toBe(snapshot);
    expect(transition(snapshot, { type: 'answer', attemptId: snapshot.currentAttempt!.id, choiceId: 'z' }, bank, env)).toBe(snapshot);
  });
  it('latest wrong replaces mastery, not lifetime XP; content changes invalidate indicators only', () => {
    const bank = questions(1);
    const env = environment();
    let snapshot = freshSnapshot(bank, env);
    snapshot = transition(snapshot, { type: 'answer', attemptId: snapshot.currentAttempt!.id, choiceId: 'a' }, bank, env);
    snapshot = transition(snapshot, { type: 'next', attemptId: snapshot.currentAttempt!.id }, bank, env);
    snapshot = transition(snapshot, { type: 'answer', attemptId: snapshot.currentAttempt!.id, choiceId: 'b' }, bank, env);
    expect(snapshot.lifetimeXp).toBe(10);
    expect(scopedProgress(snapshot, bank)).toEqual({ attemptedCount: 1, latestCorrectCount: 0 });
    const revised = [{ ...bank[0], contentRevision: 'changed' }];
    const reconciled = reconcileSnapshot(snapshot, revised, env);
    expect(reconciled.lifetimeXp).toBe(10);
    expect(reconciled.currentAttempt!.phase).toBe('asking');
    expect(scopedProgress(reconciled, revised)).toEqual({ attemptedCount: 0, latestCorrectCount: 0 });
  });
  it('keeps an empty filter empty and scopes coverage', () => {
    const bank = questions();
    const env = environment();
    let snapshot = freshSnapshot(bank, env);
    snapshot = transition(snapshot, { type: 'range', range: { startYear: 1750, endYear: 1799 } }, bank, env);
    expect(snapshot.currentAttempt).toBeNull();
    expect(snapshot.range).toEqual({ startYear: 1750, endYear: 1799 });
    expect(reconcileSnapshot(snapshot, bank, env).currentAttempt).toBeNull();
  });
  it('bounds audit history and rejects score/feedback corruption and unknown versions', () => {
    const bank = questions(1);
    const env = environment();
    let snapshot = freshSnapshot(bank, env);
    for (let index = 0; index < 105; index++) {
      snapshot = transition(snapshot, { type: 'answer', attemptId: snapshot.currentAttempt!.id, choiceId: 'a' }, bank, env);
      snapshot = transition(snapshot, { type: 'next', attemptId: snapshot.currentAttempt!.id }, bank, env);
    }
    expect(snapshot.history).toHaveLength(100);
    expect(snapshot.lifetimeXp).toBe(1050);
    expect(() => decodeSnapshot(JSON.stringify({ ...snapshot, lifetimeXp: 5 }))).toThrow();
    expect(() => decodeSnapshot(JSON.stringify({ ...snapshot, version: 99 }))).toThrow();
    const { scoringPolicy: _, ...old } = snapshot;
    expect(decodeSnapshot(JSON.stringify({ ...old, version: 1 })).lifetimeXp).toBe(1050);
    expect(decodeSnapshot(JSON.stringify(snapshot))).toEqual(snapshot as Snapshot);
  });
});
