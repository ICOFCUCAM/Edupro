import { supabase } from '../lib/supabaseClient';
import {
  getPendingUploads,
  updateUploadStatus,
  getUnsyncedLessons,
  markLessonSynced,
  cacheKnowledgeItems,
  cacheAlerts,
  cacheEmbeddings,
  setMeta,
  getMeta,
  OfflineKnowledgeCache,
  OfflineAlert,
  OfflineEmbeddingCache,
} from '../lib/offlineDB';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'complete';

let syncInProgress = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

// ── Priority-based smart sync ──────────────────────────────

interface SyncProfile {
  country: string;
  subjects?: string[];
  classLevel?: string;
}

export async function smartSync(profile: SyncProfile): Promise<{ uploaded: number; downloaded: number; errors: string[] }> {
  if (syncInProgress || !navigator.onLine) return { uploaded: 0, downloaded: 0, errors: [] };
  syncInProgress = true;

  const result = { uploaded: 0, downloaded: 0, errors: [] as string[] };

  try {
    // 1. Upload pending lesson notes
    const unsyncedLessons = await getUnsyncedLessons();
    for (const lesson of unsyncedLessons) {
      try {
        await supabase.from('lesson_notes').insert({
          country: lesson.country,
          subject: lesson.subject,
          class_level: lesson.class_level,
          title: lesson.title,
          content: lesson.content,
          tags: lesson.tags ?? [],
          visibility: lesson.visibility,
          created_at: lesson.created_at,
        });
        await markLessonSynced(lesson.id);
        result.uploaded++;
      } catch (e) {
        result.errors.push(`Lesson upload failed: ${lesson.title}`);
      }
    }

    // 2. Upload queued items
    const pending = await getPendingUploads();
    for (const item of pending) {
      try {
        await updateUploadStatus(item.id, 'syncing');
        await supabase.from('lesson_notes').insert({
          country: item.country,
          subject: item.subject,
          class_level: item.class_level,
          title: item.title,
          content: item.content,
          visibility: 'private',
          created_at: item.created_at,
        });
        await updateUploadStatus(item.id, 'uploaded');
        result.uploaded++;
      } catch {
        await updateUploadStatus(item.id, 'failed');
        result.errors.push(`Queue upload failed: ${item.title}`);
      }
    }

    // 3. Download knowledge updates (smart: teacher's country only)
    const { data: knowledgeItems } = await supabase
      .from('knowledge_items')
      .select('id, country, type, title, summary, tags, impact_level, created_at')
      .eq('country', profile.country)
      .order('created_at', { ascending: false })
      .limit(100);

    if (knowledgeItems && knowledgeItems.length > 0) {
      const cacheItems: OfflineKnowledgeCache[] = knowledgeItems.map((item) => ({
        id: item.id,
        country: item.country,
        type: item.type,
        title: item.title,
        summary: item.summary ?? '',
        tags: item.tags ?? [],
        impact_level: item.impact_level,
        last_synced: new Date().toISOString(),
      }));
      await cacheKnowledgeItems(cacheItems);
      result.downloaded += knowledgeItems.length;
    }

    // 4. Download alerts
    const { data: alerts } = await supabase
      .from('alerts')
      .select('*')
      .eq('country', profile.country)
      .eq('read_status', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (alerts && alerts.length > 0) {
      await cacheAlerts(alerts as OfflineAlert[]);
    }

    // 5. Download top 200 embeddings for offline semantic search
    const { data: embeddings } = await supabase
      .from('knowledge_embeddings')
      .select('id, content, country, embedding, reference_id')
      .eq('country', profile.country)
      .limit(200);

    if (embeddings && embeddings.length > 0) {
      await cacheEmbeddings(embeddings as OfflineEmbeddingCache[]);
    }

    await setMeta('last_sync', new Date().toISOString());
    await setMeta('sync_profile', profile);
  } finally {
    syncInProgress = false;
  }

  return result;
}

// ── Auto-sync on connection restore ───────────────────────

export function startAutoSync(profile: SyncProfile, onStatusChange?: (s: SyncStatus) => void): void {
  const runSync = async () => {
    if (!navigator.onLine) return;
    onStatusChange?.('syncing');
    try {
      await smartSync(profile);
      onStatusChange?.('complete');
    } catch {
      onStatusChange?.('error');
    }
  };

  window.addEventListener('online', () => {
    onStatusChange?.('syncing');
    runSync();
  });

  // Run every 5 minutes
  intervalId = setInterval(runSync, 5 * 60 * 1000);

  // Run immediately if online
  if (navigator.onLine) runSync();
}

export function stopAutoSync(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export async function getLastSyncTime(): Promise<string | null> {
  return (await getMeta('last_sync')) as string | null;
}
