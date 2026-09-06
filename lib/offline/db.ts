/**
 * IndexedDB wrapper for the offline PWA (Phase 8, MVP scope per
 * REQUIREMENT.MD §21): cached course module metadata for offline viewing,
 * and two pending-action queues (assessment submissions, module-progress
 * updates) flushed by lib/offline/sync.ts on reconnect.
 *
 * Deliberately minimal — no ORM, no external dependency. Every function
 * opens its own connection; IndexedDB handles are cheap and this avoids
 * holding a long-lived connection across page navigations in a service-
 * worker-adjacent context.
 *
 * Known limitation (documented, not silently ignored): no conflict
 * resolution. If the same module/assessment is also updated from another
 * device or tab while this queue is pending, the last write to sync wins —
 * acceptable for a single-trainee-single-device MVP, not a general offline
 * framework.
 */

const DB_NAME = 'coopsetu-offline';
const DB_VERSION = 2; // v2 adds pendingAttendance

const STORE_MODULES = 'modules';
const STORE_PENDING_SUBMISSIONS = 'pendingSubmissions';
const STORE_PENDING_PROGRESS = 'pendingProgress';
const STORE_PENDING_ATTENDANCE = 'pendingAttendance';

export interface CachedModule {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  type: string;
  contentUrl?: string;
  contentText?: string;
  cachedAt: string;
}

export interface PendingSubmission {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  answers: Record<string, string>;
  queuedAt: string;
}

/**
 * A check-in captured while offline.
 *
 * Attendance was the one thing that could not be recorded without a connection,
 * which is backwards for the use case: a village training centre is exactly
 * where the network is worst, and marking presence is the one thing that has to
 * happen at a fixed moment. The QR token is stored as scanned; the server still
 * validates it and its expiry on replay, so a queued check-in cannot outlive
 * the session it belongs to.
 */
export interface PendingAttendance {
  id: string;
  qrToken: string;
  traineeId?: string;
  traineeName?: string;
  sessionLabel?: string;
  queuedAt: string;
}

export interface PendingProgress {
  id: string;
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  progressPct: number;
  queuedAt: string;
}

function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (!isSupported()) return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MODULES)) {
        db.createObjectStore(STORE_MODULES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_SUBMISSIONS)) {
        db.createObjectStore(STORE_PENDING_SUBMISSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_ATTENDANCE)) {
        db.createObjectStore(STORE_PENDING_ATTENDANCE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_PROGRESS)) {
        db.createObjectStore(STORE_PENDING_PROGRESS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB.'));
  });
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    return result instanceof IDBRequest ? await promisifyRequest(result) : await result;
  } finally {
    db.close();
  }
}

async function getAll<T>(storeName: string): Promise<T[]> {
  return withStore<T[]>(storeName, 'readonly', (store) => store.getAll() as IDBRequest<T[]>);
}

// ------------------------------------------------------------- Modules ---
export async function saveModule(mod: CachedModule): Promise<void> {
  await withStore(STORE_MODULES, 'readwrite', (store) => store.put(mod));
}

export async function getModule(id: string): Promise<CachedModule | undefined> {
  return withStore<CachedModule | undefined>(STORE_MODULES, 'readonly', (store) => store.get(id));
}

export async function listModules(): Promise<CachedModule[]> {
  return getAll<CachedModule>(STORE_MODULES);
}

export async function deleteModule(id: string): Promise<void> {
  await withStore(STORE_MODULES, 'readwrite', (store) => store.delete(id));
}

// ---------------------------------------------------- Pending submissions ---
export async function queueSubmission(
  input: Omit<PendingSubmission, 'id' | 'queuedAt'>,
): Promise<PendingSubmission> {
  const record: PendingSubmission = {
    ...input,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  };
  await withStore(STORE_PENDING_SUBMISSIONS, 'readwrite', (store) => store.put(record));
  return record;
}

export async function listPendingSubmissions(): Promise<PendingSubmission[]> {
  return getAll<PendingSubmission>(STORE_PENDING_SUBMISSIONS);
}

export async function removePendingSubmission(id: string): Promise<void> {
  await withStore(STORE_PENDING_SUBMISSIONS, 'readwrite', (store) => store.delete(id));
}

// ------------------------------------------------------ Pending progress ---
export async function queueProgress(
  input: Omit<PendingProgress, 'id' | 'queuedAt'>,
): Promise<PendingProgress> {
  const record: PendingProgress = {
    ...input,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  };
  await withStore(STORE_PENDING_PROGRESS, 'readwrite', (store) => store.put(record));
  return record;
}

export async function listPendingProgress(): Promise<PendingProgress[]> {
  return getAll<PendingProgress>(STORE_PENDING_PROGRESS);
}

export async function removePendingProgress(id: string): Promise<void> {
  await withStore(STORE_PENDING_PROGRESS, 'readwrite', (store) => store.delete(id));
}

export async function queueAttendance(
  input: Omit<PendingAttendance, 'id' | 'queuedAt'>,
): Promise<PendingAttendance> {
  const record: PendingAttendance = {
    ...input,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  };
  await withStore(STORE_PENDING_ATTENDANCE, 'readwrite', (store) => store.put(record));
  return record;
}

export async function listPendingAttendance(): Promise<PendingAttendance[]> {
  return getAll<PendingAttendance>(STORE_PENDING_ATTENDANCE);
}

export async function removePendingAttendance(id: string): Promise<void> {
  await withStore(STORE_PENDING_ATTENDANCE, 'readwrite', (store) => store.delete(id));
}

export const __offlineDbSupported = isSupported;
