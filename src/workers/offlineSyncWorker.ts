import { supabase } from '@/lib/supabase';
import {
  getUnsyncedLessons, markLessonSynced, getPendingUploads, updateUploadStatus,
  cacheKnowledgeItems, cacheAlerts, setMeta, getMeta,
} from '@/lib/offlineDB';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'complete';

interface SyncProfile {
  country: string;
  subjects?: string[];
  classLevel?: string;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export async function smartSync(profile: SyncProfile): Promise<void> {
  // Upload unsynced lesson notes
  const unsyncedLessons = await getUnsyncedLessons();
  for (const lesson of unsyncedLessons) {
    try {
      const { error } = await supabase.from('lesson_notes').insert({
        title: lesson.title,
        subject: lesson.subject,
        country: lesson.country,
        level: lesson.class_level,
        class_name: lesson.class_level,
        content: JSON.parse(lesson.content),
        status: 'draft',
        visibility: lesson.visibility,
      });
      if (!error) await markLessonSynced(lesson.id);
    } catch { /* continue */ }
  }

  // Upload queued items
  const pendingUploads = await getPendingUploads();
  for (const item of pendingUploads) {
    try {
      await updateUploadStatus(item.id, 'syncing');
      const { error } = await supabase.from('lesson_notes').insert({
        title: item.title,
        subject: item.subject,
        country: item.country,
        level: item.class_level,
        class_name: item.class_level,
        content: { raw: item.content },
        status: 'draft',
      });
      await updateUploadStatus(item.id, error ? 'failed' : 'uploaded');
    } catch {
      await updateUploadStatus(item.id, 'failed');
    }
  }

  // Download knowledge items for teacher's country
  const { data: knowledgeItems } = await supabase
    .from('knowledge_items')
    .select('id, country, type, title, summary, tags, impact_level, updated_at')
    .eq('country', profile.country)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (knowledgeItems?.length) {
    await cacheKnowledgeItems(
      knowledgeItems.map(k => ({
        id: k.id,
        country: k.country,
        type: k.type || 'general',
        title: k.title,
        summary: k.summary || '',
        tags: k.tags || [],
        impact_level: k.impact_level || 'medium',
        last_synced: new Date().toISOString(),
      }))
    );
  }

  // Download alerts for teacher's country
  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, country, message, severity, read_status, created_at')
    .eq('country', profile.country)
    .eq('read_status', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (alerts?.length) {
    await cacheAlerts(alerts.map(a => ({
      id: a.id,
      country: a.country,
      message: a.message,
      severity: a.severity || 'low',
      read_status: a.read_status,
      created_at: a.created_at,
    })));
  }

  await setMeta('last_sync', new Date().toISOString());
}

export function startAutoSync(profile: SyncProfile, onStatusChange: (s: SyncStatus) => void): void {
  const doSync = async () => {
    if (!navigator.onLine) return;
    onStatusChange('syncing');
    try {
      await smartSync(profile);
      onStatusChange('complete');
    } catch {
      onStatusChange('error');
    }
  };

  window.addEventListener('online', doSync);
  syncInterval = setInterval(doSync, 5 * 60 * 1000);
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export async function getLastSyncTime(): Promise<string | null> {
  return getMeta('last_sync');
}
