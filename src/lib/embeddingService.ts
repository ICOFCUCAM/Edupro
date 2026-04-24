import { supabase } from './supabaseClient';
import { generateEmbedding } from './openaiClient';

export async function embedAndStore(
  content: string,
  country: string,
  referenceId?: string
): Promise<void> {
  const embedding = await generateEmbedding(content);

  const { error } = await supabase.from('knowledge_embeddings').insert({
    country,
    embedding,
    content,
    reference_id: referenceId ?? null,
  });

  if (error) throw error;
}

export async function semanticSearch(
  query: string,
  threshold = 0.7,
  limit = 5
): Promise<{ id: string; content: string; similarity: number }[]> {
  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) throw error;
  return data ?? [];
}
