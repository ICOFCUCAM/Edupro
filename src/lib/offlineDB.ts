// IndexedDB wrapper for EduPro offline storage
// Stores: lesson_notes, knowledge_cache, upload_queue, alerts, assistant_history, embeddings_cache

const DB_NAME = 'edupro_offline';
const DB_VERSION = 1;

export interface OfflineLessonNote {
  id: string;
  country: string;
  subject: string;
  class_level: string;
  title: string;
  content: string;
  tags?: string[];
  visibility: 'private' | 'general' | 'school_only';
  created_at: string;
  synced: boolean;
}

export interface OfflineUploadQueueItem {
  id: string;
  content: string;
  subject: string;
  class_level: string;
  country: string;
  title: string;
  status: 'pending' | 'syncing' | 'uploaded' | 'failed';
  created_at: string;
  encrypted?: boolean;
}

export interface OfflineKnowledgeCache {
  id: string;
  country: string;
  type: string;
  title: string;
  summary: string;
  tags: string[];
  impact_level: string;
  last_synced: string;
}

export interface OfflineEmbeddingCache {
  id: string;
  content: string;
  country: string;
  embedding: number[];  // compressed float32 array
  reference_id?: string;
}

export interface OfflineAlert {
  id: string;
  country: string;
  message: string;
  severity: string;
  read_status: boolean;
  created_at: string;
}

export interface AssistantHistoryItem {
  id: string;
  user_id?: string;
  country: string;
  subject: string;
  messages: { role: string; content: string }[];
  created_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('lesson_notes')) {
        const ls = db.createObjectStore('lesson_notes', { keyPath: 'id' });
        ls.createIndex('country', 'country', { unique: false });
        ls.createIndex('synced', 'synced', { unique: false });
      }

      if (!db.objectStoreNames.contains('upload_queue')) {
        const uq = db.createObjectStore('upload_queue', { keyPath: 'id' });
        uq.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains('knowledge_cache')) {
        const kc = db.createObjectStore('knowledge_cache', { keyPath: 'id' });
        kc.createIndex('country', 'country', { unique: false });
      }

      if (!db.objectStoreNames.contains('embeddings_cache')) {
        const ec = db.createObjectStore('embeddings_cache', { keyPath: 'id' });
        ec.createIndex('country', 'country', { unique: false });
      }

      if (!db.objectStoreNames.contains('alerts')) {
        const al = db.createObjectStore('alerts', { keyPath: 'id' });
        al.createIndex('country', 'country', { unique: false });
      }

      if (!db.objectStoreNames.contains('assistant_history')) {
        db.createObjectStore('assistant_history', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Meta / Sync timestamps ─────────────────────────────────

export async function setMeta(key: string, value: unknown): Promise<void> {
  await tx('meta', 'readwrite', (s) => s.put({ key, value }));
}

export async function getMeta(key: string): Promise<unknown> {
  return tx('meta', 'readonly', (s) => s.get(key));
}

// ── Lesson Notes ───────────────────────────────────────────

export async function saveLessonOffline(note: OfflineLessonNote): Promise<void> {
  await tx('lesson_notes', 'readwrite', (s) => s.put(note));
}

export async function getOfflineLessons(country?: string): Promise<OfflineLessonNote[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('lesson_notes', 'readonly');
    const req = country
      ? t.objectStore('lesson_notes').index('country').getAll(country)
      : t.objectStore('lesson_notes').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function getUnsyncedLessons(): Promise<OfflineLessonNote[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('lesson_notes', 'readonly');
    const req = t.objectStore('lesson_notes').index('synced').getAll(false);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function markLessonSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('lesson_notes', 'readwrite');
    const store = t.objectStore('lesson_notes');
    const get = store.get(id);
    get.onsuccess = () => {
      if (get.result) {
        const put = store.put({ ...get.result, synced: true });
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      } else resolve();
    };
    get.onerror = () => reject(get.error);
  });
}

// ── Upload Queue ───────────────────────────────────────────

export async function enqueueUpload(item: Omit<OfflineUploadQueueItem, 'status' | 'created_at'>): Promise<void> {
  await tx('upload_queue', 'readwrite', (s) =>
    s.put({ ...item, status: 'pending', created_at: new Date().toISOString() })
  );
}

export async function getPendingUploads(): Promise<OfflineUploadQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('upload_queue', 'readonly');
    const req = t.objectStore('upload_queue').index('status').getAll('pending');
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function updateUploadStatus(id: string, status: OfflineUploadQueueItem['status']): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('upload_queue', 'readwrite');
    const store = t.objectStore('upload_queue');
    const get = store.get(id);
    get.onsuccess = () => {
      if (get.result) store.put({ ...get.result, status });
      resolve();
    };
    get.onerror = () => reject(get.error);
  });
}

// ── Knowledge Cache ────────────────────────────────────────

export async function cacheKnowledgeItems(items: OfflineKnowledgeCache[]): Promise<void> {
  const db = await openDB();
  const t = db.transaction('knowledge_cache', 'readwrite');
  const store = t.objectStore('knowledge_cache');
  for (const item of items) store.put(item);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function searchKnowledgeOffline(query: string, country?: string): Promise<OfflineKnowledgeCache[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('knowledge_cache', 'readonly');
    const req = country
      ? t.objectStore('knowledge_cache').index('country').getAll(country)
      : t.objectStore('knowledge_cache').getAll();
    req.onsuccess = () => {
      const lower = query.toLowerCase();
      const results = (req.result ?? []).filter(
        (item: OfflineKnowledgeCache) =>
          item.title.toLowerCase().includes(lower) ||
          item.summary.toLowerCase().includes(lower) ||
          (item.tags ?? []).some((tag) => tag.toLowerCase().includes(lower))
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Embeddings Cache (top 200 chunks) ─────────────────────

export async function cacheEmbeddings(items: OfflineEmbeddingCache[]): Promise<void> {
  const db = await openDB();
  const t = db.transaction('embeddings_cache', 'readwrite');
  const store = t.objectStore('embeddings_cache');
  for (const item of items) store.put(item);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function localSemanticSearch(
  queryEmbedding: number[],
  country?: string,
  topK = 5
): Promise<{ id: string; content: string; similarity: number }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('embeddings_cache', 'readonly');
    const req = country
      ? t.objectStore('embeddings_cache').index('country').getAll(country)
      : t.objectStore('embeddings_cache').getAll();
    req.onsuccess = () => {
      const items: OfflineEmbeddingCache[] = req.result ?? [];
      const scored = items.map((item) => ({
        id: item.id,
        content: item.content,
        similarity: cosineSimilarity(queryEmbedding, item.embedding),
      }));
      scored.sort((a, b) => b.similarity - a.similarity);
      resolve(scored.slice(0, topK));
    };
    req.onerror = () => reject(req.error);
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

// ── Alerts ────────────────────────────────────────────────

export async function cacheAlerts(alerts: OfflineAlert[]): Promise<void> {
  const db = await openDB();
  const t = db.transaction('alerts', 'readwrite');
  const store = t.objectStore('alerts');
  for (const alert of alerts) store.put(alert);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getOfflineAlerts(country?: string): Promise<OfflineAlert[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('alerts', 'readonly');
    const req = country
      ? t.objectStore('alerts').index('country').getAll(country)
      : t.objectStore('alerts').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

// ── Assistant History ──────────────────────────────────────

export async function saveAssistantSession(session: AssistantHistoryItem): Promise<void> {
  await tx('assistant_history', 'readwrite', (s) => s.put(session));
}

export async function getAssistantHistory(userId?: string): Promise<AssistantHistoryItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('assistant_history', 'readonly');
    const req = t.objectStore('assistant_history').getAll();
    req.onsuccess = () => {
      const all: AssistantHistoryItem[] = req.result ?? [];
      resolve(userId ? all.filter((s) => s.user_id === userId) : all);
    };
    req.onerror = () => reject(req.error);
  });
}
