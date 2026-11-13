import { describe, expect, it } from 'vitest';
import { decodeSnapshot } from '../src/domain/engine';
import { consentedProgressExport } from '../src/persistence/import-adapter';
import { ProgressStore, STORAGE_KEY, type LockPort, type StoragePort } from '../src/persistence/store';
import { environment, questions } from './fixtures';

class MemoryStorage implements StoragePort {
  raw: string | null = null;
  denied = false;
  quota = false;
  getItem(_: string) {
    if (this.denied) throw new Error('Access denied');
    return this.raw;
  }
  setItem(_: string, value: string) {
    if (this.quota) throw new Error('Quota exceeded');
    this.raw = value;
  }
}
class SerialLocks implements LockPort {
  private queue: Promise<unknown> = Promise.resolve();
  request<T>(_: string, callback: () => Promise<T>): Promise<T> {
    const result = this.queue.then(callback);
    this.queue = result.catch(() => {});
    return result;
  }
}

describe('atomic browser profile persistence', () => {
  it('saves choice order/selection and answered XP in one reload-safe snapshot', async () => {
    const storage = new MemoryStorage();
    const locks = new SerialLocks();
    const env = environment();
    const store = new ProgressStore(questions(1), storage, locks, env);
    await store.initialize();
    const attempt = store.getSnapshot().snapshot.currentAttempt!;
    await store.dispatch({ type: 'select', attemptId: attempt.id, choiceId: 'a' });
    const reload = new ProgressStore(questions(1), storage, locks, env);
    await reload.initialize();
    expect(reload.getSnapshot().snapshot.currentAttempt).toEqual({ ...attempt, selectedChoiceId: 'a' });
    await reload.dispatch({ type: 'answer', attemptId: attempt.id, choiceId: 'a' });
    const persisted = decodeSnapshot(storage.getItem(STORAGE_KEY)!);
    expect(persisted.lifetimeXp).toBe(10);
    expect(persisted.currentAttempt!.phase).toBe('answered');
    const secondReload = new ProgressStore(questions(1), storage, locks, env);
    await secondReload.initialize();
    await secondReload.dispatch({ type: 'answer', attemptId: attempt.id, choiceId: 'a' });
    expect(secondReload.getSnapshot().snapshot.lifetimeXp).toBe(10);
  });
  it('first answer wins across tabs and a stale next cannot skip an attempt', async () => {
    const storage = new MemoryStorage();
    const locks = new SerialLocks();
    const env = environment();
    const first = new ProgressStore(questions(1), storage, locks, env);
    const second = new ProgressStore(questions(1), storage, locks, env);
    await Promise.all([first.initialize(), second.initialize()]);
    const attempt = first.getSnapshot().snapshot.currentAttempt!;
    await Promise.all([
      first.dispatch({ type: 'answer', attemptId: attempt.id, choiceId: 'a' }),
      second.dispatch({ type: 'answer', attemptId: attempt.id, choiceId: 'b' }),
    ]);
    await first.synchronize();
    expect(first.getSnapshot().snapshot).toEqual(second.getSnapshot().snapshot);
    expect(first.getSnapshot().snapshot.lifetimeXp).toBe(10);
    expect(first.getSnapshot().snapshot.currentAttempt!.wasCorrect).toBe(true);
    await Promise.all([
      first.dispatch({ type: 'next', attemptId: attempt.id }),
      second.dispatch({ type: 'next', attemptId: attempt.id }),
    ]);
    const newAttempt = second.getSnapshot().snapshot.currentAttempt!;
    expect(newAttempt.id).not.toBe(attempt.id);
    expect(second.getSnapshot().snapshot.progress.q0.attempts).toBe(1);
    await second.dispatch({ type: 'answer', attemptId: newAttempt.id, choiceId: 'a' });
    expect(decodeSnapshot(storage.raw!).lifetimeXp).toBe(20);
  });
  it.each(['{broken', '{"version":99,"valuable":"preserve me"}'])(
    'preserves corrupt or unrecognized storage until explicit reset: %s', async raw => {
      const storage = new MemoryStorage();
      storage.raw = raw;
      const store = new ProgressStore(questions(1), storage, new SerialLocks(), environment());
      await store.initialize();
      expect(store.getSnapshot().notice).toContain('unveraendert');
      await store.dispatch({ type: 'answer', attemptId: store.getSnapshot().snapshot.currentAttempt!.id, choiceId: 'a' });
      expect(storage.raw).toBe(raw);
      await store.dispatch({ type: 'reset' });
      expect(decodeSnapshot(storage.raw!).lifetimeXp).toBe(0);
      expect(store.getSnapshot().notice).toBeNull();
    },
  );
  it('preserves an externally corrupted value and can explicitly recover', async () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore(questions(1), storage, new SerialLocks(), environment());
    await store.initialize();
    storage.raw = 'corruption';
    await store.dispatch({ type: 'answer', attemptId: store.getSnapshot().snapshot.currentAttempt!.id, choiceId: 'a' });
    expect(storage.raw).toBe('corruption');
    await store.dispatch({ type: 'reset' });
    expect(decodeSnapshot(storage.raw!).lifetimeXp).toBe(0);
  });
  it('visibly switches to session-only on quota before presenting an unsaved reward', async () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore(questions(1), storage, new SerialLocks(), environment());
    await store.initialize();
    const priorRaw = storage.raw;
    storage.quota = true;
    const views: ReturnType<typeof store.getSnapshot>[] = [];
    store.subscribe(() => views.push(store.getSnapshot()));
    await store.dispatch({ type: 'answer', attemptId: store.getSnapshot().snapshot.currentAttempt!.id, choiceId: 'a' });
    expect(storage.raw).toBe(priorRaw);
    expect(views).toHaveLength(1);
    expect(views[0].snapshot.lifetimeXp).toBe(10);
    expect(views[0].notice).toContain('Nur diese Sitzung');
    expect(views[0].notice).toContain('Quota exceeded');
  });
  it('handles denied storage and missing/denied Web Locks visibly without writing', async () => {
    const storage = new MemoryStorage();
    storage.denied = true;
    const denied = new ProgressStore(questions(1), storage, new SerialLocks(), environment());
    await denied.initialize();
    expect(denied.getSnapshot().notice).toContain('Access denied');
    storage.denied = false;
    const missing = new ProgressStore(questions(1), storage, null, environment());
    await missing.initialize();
    expect(missing.getSnapshot().notice).toContain('Web Locks');
    const deniedLocks: LockPort = { request: async () => { throw new Error('Lock denied'); } };
    const broken = new ProgressStore(questions(1), storage, deniedLocks, environment());
    await broken.initialize();
    expect(broken.getSnapshot().notice).toContain('Lock denied');
    expect(storage.raw).toBeNull();
  });
  it('synchronizes a cleared profile with a persisted, playable fresh attempt', async () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore(questions(1), storage, new SerialLocks(), environment());
    await store.initialize();
    storage.raw = null;
    await store.synchronize();
    const attempt = store.getSnapshot().snapshot.currentAttempt!;
    await store.dispatch({ type: 'answer', attemptId: attempt.id, choiceId: 'a' });
    expect(store.getSnapshot().snapshot.lifetimeXp).toBe(10);
  });
  it('loads existing XP read-only when locks become unavailable', async () => {
    const storage = new MemoryStorage();
    const env = environment();
    const saved = new ProgressStore(questions(1), storage, new SerialLocks(), env);
    await saved.initialize();
    await saved.dispatch({ type: 'answer', attemptId: saved.getSnapshot().snapshot.currentAttempt!.id, choiceId: 'a' });
    const raw = storage.raw;
    const session = new ProgressStore(questions(1), storage, null, env);
    await session.initialize();
    expect(session.getSnapshot().snapshot.lifetimeXp).toBe(10);
    expect(session.getSnapshot().notice).toContain('Nur diese Sitzung');
    await session.dispatch({ type: 'next', attemptId: session.getSnapshot().snapshot.currentAttempt!.id });
    await session.dispatch({ type: 'answer', attemptId: session.getSnapshot().snapshot.currentAttempt!.id, choiceId: 'a' });
    expect(session.getSnapshot().snapshot.lifetimeXp).toBe(20);
    expect(storage.raw).toBe(raw);
  });
  it('rejects invalid ranges without changing stored progress and requires export consent', async () => {
    const storage = new MemoryStorage();
    const store = new ProgressStore(questions(1), storage, new SerialLocks(), environment());
    await store.initialize();
    const raw = storage.raw;
    await expect(store.dispatch({ type: 'range', range: { startYear: 1800, endYear: 1700 } })).rejects.toThrow();
    expect(storage.raw).toBe(raw);
    const snapshot = store.getSnapshot().snapshot;
    expect(() => consentedProgressExport(snapshot, false)).toThrow('consent');
    expect(consentedProgressExport(snapshot, true).idempotencyKey).toBe(`${snapshot.profileId}:${snapshot.revision}`);
  });
});
