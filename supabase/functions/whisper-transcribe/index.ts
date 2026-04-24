import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Whisper supports: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
const MIME_TO_EXT: Record<string, string> = {
  'audio/webm':           'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg':            'ogg',
  'audio/ogg;codecs=opus': 'ogg',
  'audio/mp4':            'mp4',
  'audio/mpeg':           'mp3',
  'audio/wav':            'wav',
  'audio/flac':           'flac',
};

function mimeToExt(mimeType: string): string {
  const base = mimeType.split(';')[0].trim();
  return MIME_TO_EXT[mimeType] ?? MIME_TO_EXT[base] ?? 'webm';
}

// Language codes Whisper recognises (ISO 639-1 two-letter)
const VALID_WHISPER_LANGS = new Set([
  'en','fr','ar','sw','pt','ha','yo','ig','zu','af','am','az','be','bg',
  'bs','ca','cs','cy','da','de','el','es','et','eu','fa','fi','gl','gu',
  'he','hi','hr','hu','hy','id','is','it','ja','jw','ka','kk','km','kn',
  'ko','lb','lo','lt','lv','mg','mi','mk','ml','mn','mr','ms','mt','my',
  'ne','nl','nn','no','oc','pa','pl','ps','ro','ru','sa','sd','si','sk',
  'sl','sn','so','sq','sr','su','sv','ta','te','tg','th','tk','tl','tr',
  'tt','uk','ur','uz','vi','yi','zh',
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { audio, mimeType = 'audio/webm', language } = await req.json();

    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'audio (base64 string) is required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY secret not configured' }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Decode base64 → Uint8Array
    const binaryStr = atob(audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const ext = mimeToExt(mimeType);
    const blob = new Blob([bytes], { type: mimeType.split(';')[0].trim() });

    // Build FormData for Whisper endpoint
    const formData = new FormData();
    formData.append('file', blob, `recording.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    // Apply language hint when provided and valid (strip region: 'en-NG' → 'en')
    if (language) {
      const lang2 = language.split('-')[0].toLowerCase();
      if (VALID_WHISPER_LANGS.has(lang2)) {
        formData.append('language', lang2);
      }
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenAI Whisper error (${response.status}): ${errText}` }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        transcript: result.text?.trim() ?? '',
        language:  result.language ?? (language?.split('-')[0] ?? 'en'),
        duration:  result.duration  ?? null,
        segments:  result.segments?.length ?? 0,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
