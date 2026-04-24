import { supabase } from '../lib/supabaseClient';
import { embedAndStore } from '../lib/embeddingService';
import { chunkText } from '../lib/documentParser';

export async function processUpload(
  file: File,
  country: string,
  ownerId: string
): Promise<string> {
  const { data: job, error: jobErr } = await supabase
    .from('ingestion_jobs')
    .insert({ file_name: file.name, country, status: 'queued' })
    .select()
    .single();

  if (jobErr) throw jobErr;

  const jobId: string = job.id;

  // Upload file to Supabase Storage
  const filePath = `uploads/${country}/${Date.now()}_${file.name}`;
  const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
  if (uploadErr) {
    await supabase.from('ingestion_jobs').update({ status: 'failed' }).eq('id', jobId);
    throw uploadErr;
  }

  await supabase.from('ingestion_jobs').update({ status: 'processing' }).eq('id', jobId);

  // For text files: parse and embed immediately
  if (file.type === 'text/plain') {
    const text = await file.text();
    const chunks = chunkText(text);

    const { data: note } = await supabase
      .from('lesson_notes')
      .insert({
        country,
        subject: 'General',
        class_level: 'All',
        title: file.name.replace(/\.[^.]+$/, ''),
        content: text,
        visibility: 'private',
        owner_id: ownerId,
        source_type: 'pdf_upload',
      })
      .select()
      .single();

    let processed = 0;
    for (const chunk of chunks) {
      await embedAndStore(chunk, country, note?.id);
      processed++;
      await supabase.from('ingestion_jobs').update({ processed_chunks: processed }).eq('id', jobId);
    }
  }

  await supabase.from('ingestion_jobs').update({ status: 'completed' }).eq('id', jobId);
  return jobId;
}
