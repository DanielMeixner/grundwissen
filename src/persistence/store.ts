import {
  browserEnvironment, decodeSnapshot, freshSnapshot, reconcileSnapshot, transition,
  type Command, type EngineEnvironment, type Snapshot,
} from '../domain/engine';
import type { Question } from '../domain/question';

export const STORAGE_KEY = 'grundwissen.progress';
const LOCK_NAME = `${STORAGE_KEY}.write`;
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type LockPort = { request<T>(name: string, callback: () => Promise<T>): Promise<T> };
export type StoreView = { snapshot: Snapshot; notice: string | null };

const SESSION_NOTICE = 'Nur diese Sitzung: Fortschritt wird nicht dauerhaft gespeichert.';
const PRESERVED_NOTICE = 'Gespeicherte Daten sind beschaedigt oder stammen aus einer unbekannten Version. ' +
  'Sie bleiben unveraendert; bis zum bewussten Zuruecksetzen gilt nur diese Sitzung.';
const UPDATED_BANK_NOTICE = 'Ein anderer Tab verwendet eine andere Fragenfassung. Bitte die Seite neu laden. ' +
  'Der gemeinsame gespeicherte Stand wird von diesem Tab nicht ueberschrieben.';

export class ProgressStore {
  private view: StoreView;
  private persistent = false;
  private initialized = false;
  private serial: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(
    private bank: Question[],
    private storage: StoragePort | null,
    private locks: LockPort | null,
    private env: EngineEnvironment = browserEnvironment,
  ) {
    this.view = { snapshot: freshSnapshot(bank, env), notice: null };
  }

  getSnapshot = (): StoreView => this.view;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(snapshot: Snapshot, notice = this.view.notice) {
    this.view = { snapshot, notice };
    this.listeners.forEach(listener => listener());
  }

  private sessionOnly(snapshot: Snapshot, reason: string) {
    this.persistent = false;
    this.publish(snapshot, `${SESSION_NOTICE} ${reason}`);
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const result = this.serial.then(work);
    this.serial = result.catch(() => { /* Caller receives the error; keep later commands usable. */ });
    return result;
  }

  async initialize(): Promise<void> {
    return this.enqueue(async () => {
      if (this.initialized) return;
      this.initialized = true;
      if (!this.locks || !this.storage) {
        let snapshot = this.view.snapshot;
        if (this.storage) {
          let raw: string | null;
          try { raw = this.storage.getItem(STORAGE_KEY); }
          catch (error) {
            this.sessionOnly(snapshot, `Speicherzugriff verweigert: ${errorText(error)}`);
            return;
          }
          if (raw !== null) {
            try { snapshot = reconcileSnapshot(decodeSnapshot(raw), this.bank, this.env); }
            catch {
              this.sessionOnly(snapshot, PRESERVED_NOTICE);
              return;
            }
          }
        }
        this.sessionOnly(snapshot, 'Browserspeicher oder Web Locks sind nicht verfuegbar.');
        return;
      }
      let entered = false;
      try {
        await this.locks.request(LOCK_NAME, async () => {
          entered = true;
          let raw: string | null;
          try { raw = this.storage!.getItem(STORAGE_KEY); }
          catch (error) {
            this.sessionOnly(this.view.snapshot, `Speicherzugriff verweigert: ${errorText(error)}`);
            return;
          }
          let loaded: Snapshot;
          try { loaded = raw === null ? this.view.snapshot : decodeSnapshot(raw); }
          catch {
            this.sessionOnly(this.view.snapshot, PRESERVED_NOTICE);
            return;
          }
          const snapshot = reconcileSnapshot(loaded, this.bank, this.env);
          try { this.storage!.setItem(STORAGE_KEY, JSON.stringify(snapshot)); }
          catch (error) {
            this.sessionOnly(snapshot, `Speichern fehlgeschlagen: ${errorText(error)}`);
            return;
          }
          this.persistent = true;
          this.publish(snapshot, null);
        });
      } catch (error) {
        if (entered) throw error;
        this.sessionOnly(this.view.snapshot, `Web Locks nicht nutzbar: ${errorText(error)}`);
      }
    });
  }

  async dispatch(command: Command): Promise<void> {
    if (!this.initialized) throw new Error('Progress store is not initialized');
    if (command.type === 'select') {
      // Selection is reversible; only answer/reward feedback must await the atomic save.
      const optimistic = transition(this.view.snapshot, command, this.bank, this.env);
      if (optimistic !== this.view.snapshot) this.publish(optimistic);
    }
    return this.enqueue(async () => {
      if (command.type === 'reset' && this.storage && this.locks) {
        await this.recover();
        return;
      }
      if (!this.persistent) {
        const snapshot = transition(this.view.snapshot, command, this.bank, this.env);
        this.publish({ ...snapshot, revision: incrementRevision(snapshot.revision) });
        return;
      }
      let entered = false;
      try {
        await this.locks!.request(LOCK_NAME, async () => {
          entered = true;
          let raw: string | null;
          try { raw = this.storage!.getItem(STORAGE_KEY); }
          catch (error) {
            const next = transition(this.view.snapshot, command, this.bank, this.env);
            this.sessionOnly(next, `Speicherzugriff verweigert: ${errorText(error)}`);
            return;
          }
          let loaded: Snapshot;
          try { loaded = raw === null ? freshSnapshot(this.bank, this.env) : decodeSnapshot(raw); }
          catch {
            this.sessionOnly(this.view.snapshot, PRESERVED_NOTICE);
            return;
          }
          if (loaded.bankRevision !== this.view.snapshot.bankRevision) {
            this.sessionOnly(reconcileSnapshot(loaded, this.bank, this.env), UPDATED_BANK_NOTICE);
            return;
          }
          const base = reconcileSnapshot(loaded, this.bank, this.env);
          const next = transition(base, command, this.bank, this.env);
          const snapshot = { ...next, revision: incrementRevision(base.revision) };
          try { this.storage!.setItem(STORAGE_KEY, JSON.stringify(snapshot)); }
          catch (error) {
            this.sessionOnly(snapshot, `Speichern fehlgeschlagen: ${errorText(error)}`);
            return;
          }
          this.publish(snapshot, null);
        });
      } catch (error) {
        if (entered) throw error;
        const next = transition(this.view.snapshot, command, this.bank, this.env);
        this.sessionOnly(next, `Web Locks nicht nutzbar: ${errorText(error)}`);
      }
    });
  }

  private async recover() {
    const snapshot = freshSnapshot(this.bank, this.env);
    let entered = false;
    try {
      await this.locks!.request(LOCK_NAME, async () => {
        entered = true;
        try { this.storage!.setItem(STORAGE_KEY, JSON.stringify(snapshot)); }
        catch (error) {
          this.sessionOnly(snapshot, `Zuruecksetzen konnte nicht gespeichert werden: ${errorText(error)}`);
          return;
        }
        this.persistent = true;
        this.publish(snapshot, null);
      });
    } catch (error) {
      if (entered) throw error;
      this.sessionOnly(snapshot, `Web Locks nicht nutzbar: ${errorText(error)}`);
    }
  }

  async synchronize(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.persistent) return;
      let entered = false;
      try {
        await this.locks!.request(LOCK_NAME, async () => {
          entered = true;
          let raw: string | null;
          try { raw = this.storage!.getItem(STORAGE_KEY); }
          catch (error) {
            this.sessionOnly(this.view.snapshot, `Speicherzugriff verweigert: ${errorText(error)}`);
            return;
          }
          let snapshot: Snapshot;
          try { snapshot = raw === null ? freshSnapshot(this.bank, this.env) : decodeSnapshot(raw); }
          catch {
            this.sessionOnly(this.view.snapshot, PRESERVED_NOTICE);
            return;
          }
          if (snapshot.bankRevision !== this.view.snapshot.bankRevision) {
            this.sessionOnly(reconcileSnapshot(snapshot, this.bank, this.env), UPDATED_BANK_NOTICE);
            return;
          }
          const reconciled = reconcileSnapshot(snapshot, this.bank, this.env);
          try { this.storage!.setItem(STORAGE_KEY, JSON.stringify(reconciled)); }
          catch (error) {
            this.sessionOnly(reconciled, `Speichern fehlgeschlagen: ${errorText(error)}`);
            return;
          }
          this.publish(reconciled, null);
        });
      } catch (error) {
        if (entered) throw error;
        this.sessionOnly(this.view.snapshot, `Web Locks nicht nutzbar: ${errorText(error)}`);
      }
    });
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function incrementRevision(revision: number): number {
  if (revision >= Number.MAX_SAFE_INTEGER) throw new Error('Die maximale Fortschrittsrevision ist erreicht.');
  return revision + 1;
}

export function browserStore(bank: Question[]): ProgressStore {
  let storage: StoragePort | null = null;
  try { storage = window.localStorage; }
  catch { /* The store visibly explains unavailable browser storage. */ }
  return new ProgressStore(bank, storage, navigator.locks ?? null);
}
