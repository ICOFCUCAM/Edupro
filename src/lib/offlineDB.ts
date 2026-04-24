// IndexedDB wrapper for EduPro offline storage
const DB_NAME = 'edupro_offline';
const DB_VERSION = 2;

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
  embedding: number[];
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
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  session_id: string;
}

export interface OfflineStudentResult {
  id: string;
  student_id: string;
  assessment_package_id: string;
  organization_id?: string;
  score: number;
  max_score: number;
  synced: boolean;
  created_at: string;
}

export interface OfflineObjectiveMastery {
  id: string;               // composite: `${student_id}_${objective_id}`
  student_id: string;
  objective_id: string;
  mastery_level: string;
  confidence_score: number;
  last_updated: string;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('lesson_notes')) {
        const store = db.createObjectStore('lesson_notes', { keyPath: 'id' });
        store.createIndex('synced', 'synced');
        store.createIndex('country', 'country');
      }
      if (!db.objectStoreNames.contains('upload_queue')) {
        const store = db.createObjectStore('upload_queue', { keyPath: 'id' });
        store.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('knowledge_cache')) {
        const store = db.createObjectStore('knowledge_cache', { keyPath: 'id' });
        store.createIndex('country', 'country');
      }
      if (!db.objectStoreNames.contains('embeddings_cache')) {
        db.createObjectStore('embeddings_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('alerts')) {
        const store = db.createObjectStore('alerts', { keyPath: 'id' });
        store.createIndex('country', 'country');
      }
      if (!db.objectStoreNames.contains('assistant_history')) {
        const store = db.createObjectStore('assistant_history', { keyPath: 'id' });
        store.createIndex('session_id', 'session_id');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      // v2 stores
      if (!db.objectStoreNames.contains('student_results')) {
        const store = db.createObjectStore('student_results', { keyPath: 'id' });
        store.createIndex('synced', 'synced');
        store.createIndex('organization_id', 'organization_id');
      }
      if (!db.objectStoreNames.contains('objective_mastery')) {
        const store = db.createObjectStore('objective_mastery', { keyPath: 'id' });
        store.createIndex('synced', 'synced');
        store.createIndex('student_id', 'student_id');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGetAll<T>(db: IDBDatabase, store: string, indexName?: string, query?: IDBValidKey): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const req = indexName ? s.index(indexName).getAll(query) : s.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txPut(db: IDBDatabase, store: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function txDelete(db: IDBDatabase, store: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Lesson notes
export async function saveLessonOffline(note: OfflineLessonNote): Promise<void> {
  const db = await openDB();
  await txPut(db, 'lesson_notes', note);
}

export async function getOfflineLessons(): Promise<OfflineLessonNote[]> {
  const db = await openDB();
  return txGetAll<OfflineLessonNote>(db, 'lesson_notes');
}

export async function getUnsyncedLessons(): Promise<OfflineLessonNote[]> {
  const db = await openDB();
  return txGetAll<OfflineLessonNote>(db, 'lesson_notes', 'synced', IDBKeyRange.only(0));
}

export async function markLessonSynced(id: string): Promise<void> {
  const db = await openDB();
  const note = await txGet<OfflineLessonNote>(db, 'lesson_notes', id);
  if (note) await txPut(db, 'lesson_notes', { ...note, synced: true });
}

// Upload queue
export async function enqueueUpload(item: OfflineUploadQueueItem): Promise<void> {
  const db = await openDB();
  await txPut(db, 'upload_queue', item);
}

export async function getPendingUploads(): Promise<OfflineUploadQueueItem[]> {
  const db = await openDB();
  return txGetAll<OfflineUploadQueueItem>(db, 'upload_queue', 'status', 'pending');
}

export async function updateUploadStatus(id: string, status: OfflineUploadQueueItem['status']): Promise<void> {
  const db = await openDB();
  const item = await txGet<OfflineUploadQueueItem>(db, 'upload_queue', id);
  if (item) await txPut(db, 'upload_queue', { ...item, status });
}

// Knowledge cache
export async function cacheKnowledgeItems(items: OfflineKnowledgeCache[]): Promise<void> {
  const db = await openDB();
  await Promise.all(items.map(item => txPut(db, 'knowledge_cache', item)));
}

export async function searchKnowledgeOffline(query: string, country?: string): Promise<OfflineKnowledgeCache[]> {
  const db = await openDB();
  const all = country
    ? await txGetAll<OfflineKnowledgeCache>(db, 'knowledge_cache', 'country', country)
    : await txGetAll<OfflineKnowledgeCache>(db, 'knowledge_cache');
  const q = query.toLowerCase();
  return all.filter(k =>
    k.title?.toLowerCase().includes(q) ||
    k.summary?.toLowerCase().includes(q) ||
    k.tags?.some(t => t.toLowerCase().includes(q))
  );
}

// Embeddings cache
export async function cacheEmbeddings(items: OfflineEmbeddingCache[]): Promise<void> {
  const db = await openDB();
  await Promise.all(items.map(item => txPut(db, 'embeddings_cache', item)));
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export async function localSemanticSearch(queryEmbedding: number[], topK = 5): Promise<OfflineEmbeddingCache[]> {
  const db = await openDB();
  const all = await txGetAll<OfflineEmbeddingCache>(db, 'embeddings_cache');
  return all
    .map(item => ({ ...item, score: cosineSimilarity(queryEmbedding, item.embedding) }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topK);
}

// Alerts
export async function cacheAlerts(alerts: OfflineAlert[]): Promise<void> {
  const db = await openDB();
  await Promise.all(alerts.map(a => txPut(db, 'alerts', a)));
}

export async function getOfflineAlerts(country?: string): Promise<OfflineAlert[]> {
  const db = await openDB();
  return country
    ? txGetAll<OfflineAlert>(db, 'alerts', 'country', country)
    : txGetAll<OfflineAlert>(db, 'alerts');
}

// Assistant history
export async function saveAssistantSession(item: AssistantHistoryItem): Promise<void> {
  const db = await openDB();
  await txPut(db, 'assistant_history', item);
}

export async function getAssistantHistory(sessionId: string): Promise<AssistantHistoryItem[]> {
  const db = await openDB();
  return txGetAll<AssistantHistoryItem>(db, 'assistant_history', 'session_id', sessionId);
}

// Meta
export async function setMeta(key: string, value: string): Promise<void> {
  const db = await openDB();
  await txPut(db, 'meta', { key, value });
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await openDB();
  const result = await txGet<{ key: string; value: string }>(db, 'meta', key);
  return result?.value ?? null;
}

// Student results (offline queue)
export async function saveStudentResultOffline(item: OfflineStudentResult): Promise<void> {
  const db = await openDB();
  await txPut(db, 'student_results', item);
}

export async function getUnsyncedStudentResults(): Promise<OfflineStudentResult[]> {
  const db = await openDB();
  return txGetAll<OfflineStudentResult>(db, 'student_results', 'synced', IDBKeyRange.only(0));
}

export async function markStudentResultSynced(id: string): Promise<void> {
  const db = await openDB();
  const item = await txGet<OfflineStudentResult>(db, 'student_results', id);
  if (item) await txPut(db, 'student_results', { ...item, synced: true });
}

// Objective mastery (offline cache)
export async function saveObjectiveMasteryOffline(item: OfflineObjectiveMastery): Promise<void> {
  const db = await openDB();
  await txPut(db, 'objective_mastery', item);
}

export async function getUnsyncedObjectiveMastery(): Promise<OfflineObjectiveMastery[]> {
  const db = await openDB();
  return txGetAll<OfflineObjectiveMastery>(db, 'objective_mastery', 'synced', IDBKeyRange.only(0));
}

export async function markObjectiveMasterySynced(id: string): Promise<void> {
  const db = await openDB();
  const item = await txGet<OfflineObjectiveMastery>(db, 'objective_mastery', id);
  if (item) await txPut(db, 'objective_mastery', { ...item, synced: true });
}
