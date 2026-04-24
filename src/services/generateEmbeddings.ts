import { supabase } from '../lib/supabaseClient';
import { embedAndStore } from '../lib/embeddingService';

export async function embedKnowledgeItem(itemId: string): Promise<void> {
  const { data: item, error } = await supabase
    .from('knowledge_items')
    .select('country, title, summary')
    .eq('id', itemId)
    .single();

  if (error || !item) throw error ?? new Error('Item not found');

  const content = `${item.title}. ${item.summary ?? ''}`.trim();
  await embedAndStore(content, item.country, itemId);
}

export async function embedAllPending(country?: string): Promise<number> {
  let query = supabase.from('knowledge_items').select('id, country, title, summary');
  if (country) query = query.eq('country', country);

  const { data: items, error } = await query;
  if (error) throw error;

  let count = 0;
  for (const item of items ?? []) {
    try {
      const content = `${item.title}. ${item.summary ?? ''}`.trim();
      await embedAndStore(content, item.country, item.id);
      count++;
    } catch {
      // continue on single failure
    }
  }
  return count;
}
