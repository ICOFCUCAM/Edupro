export interface ParsedDocument {
  text: string;
  chunks: string[];
  metadata: { fileName: string; fileType: string; pageCount?: number };
}

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 50);
}

export async function parseFile(file: File): Promise<ParsedDocument> {
  const fileType = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (fileType === 'txt') {
    const text = await file.text();
    return { text, chunks: chunkText(text), metadata: { fileName: file.name, fileType } };
  }

  // PDF and DOCX require server-side parsing via edge function
  // Return metadata only; actual parsing happens in processUploads service
  return {
    text: '',
    chunks: [],
    metadata: { fileName: file.name, fileType },
  };
}

export function extractMetaFromFilename(fileName: string): {
  country?: string;
  subject?: string;
  level?: string;
} {
  const lower = fileName.toLowerCase();
  const countries = ['nigeria', 'ghana', 'kenya', 'cameroon', 'tanzania', 'uganda', 'rwanda', 'ethiopia', 'senegal', 'drc', 'south africa'];
  const country = countries.find((c) => lower.includes(c));
  return { country };
}
