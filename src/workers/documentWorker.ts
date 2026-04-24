import { supabase } from '../lib/supabaseClient';
import { embedAndStore } from '../lib/embeddingService';
import { chunkText } from '../lib/documentParser';

export async function processQueuedJobs(): Promise<number> {
  const { data: jobs } = await supabase
    .from('ingestion_jobs')
    .select('*')
    .eq('status', 'queued')
    .limit(10);

  let processed = 0;
  for (const job of jobs ?? []) {
    try {
      await supabase.from('ingestion_jobs').update({ status: 'processing' }).eq('id', job.id);

      // Retrieve file from storage and process
      const { data: fileData } = await supabase.storage
        .from('documents')
        .download(`uploads/${job.country}/${job.file_name}`);

      if (fileData) {
        const text = await fileData.text();
        const chunks = chunkText(text);
        let count = 0;
        for (const chunk of chunks) {
          await embedAndStore(chunk, job.country);
          count++;
        }
        await supabase.from('ingestion_jobs').update({ status: 'completed', processed_chunks: count }).eq('id', job.id);
        processed++;
      }
    } catch {
      await supabase.from('ingestion_jobs').update({ status: 'failed' }).eq('id', job.id);
    }
  }
  return processed;
}
