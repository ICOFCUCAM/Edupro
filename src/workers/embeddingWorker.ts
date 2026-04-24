import { embedAllPending } from '../services/generateEmbeddings';

export async function runEmbeddingWorker(country?: string): Promise<number> {
  return embedAllPending(country);
}
