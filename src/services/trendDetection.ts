import { supabase } from '../lib/supabaseClient';
import { chatCompletion } from '../lib/openaiClient';

export async function detectTrends(country: string): Promise<void> {
  const { data: items } = await supabase
    .from('knowledge_items')
    .select('title, summary, type, impact_level, created_at')
    .eq('country', country)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!items || items.length === 0) return;

  const context = items.map((i) => `- [${i.impact_level}] ${i.title}: ${i.summary}`).join('\n');

  const prompt = `Analyze these recent education updates for ${country} and identify 3 key trends:

${context}

Return a JSON array with this structure:
[{
  "trend_type": "curriculum_shift|policy_change|subject_priority|exam_structure_change|regional_pattern",
  "description": "clear description of the trend",
  "impact_score": 0-100
}]

Return only the JSON array, no markdown.`;

  const result = await chatCompletion([{ role: 'user', content: prompt }]);

  let trends: { trend_type: string; description: string; impact_score: number }[] = [];
  try {
    const match = result.match(/\[[\s\S]*\]/);
    trends = JSON.parse(match ? match[0] : result);
  } catch {
    return;
  }

  if (trends.length > 0) {
    await supabase.from('education_trends').insert(
      trends.map((t) => ({ ...t, country }))
    );
  }
}
