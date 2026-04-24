import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CrosswalkMatch {
  id:                  string;
  source_country:      string;
  target_country:      string;
  source_objective_id: string;
  target_objective_id: string;
  similarity_score:    number;
  notes?:              string;
  // joined
  source_text?:        string;
  source_topic?:       string;
  source_class_level?: string;
  target_text?:        string;
  target_topic?:       string;
  target_class_level?: string;
}

export interface SimilarityIndex {
  id:                      string;
  country_a:               string;
  country_b:               string;
  subject:                 string;
  similarity_score:        number;
  matched_objectives:      number;
  total_source_objectives: number;
  computed_at:             string;
}

export interface ClassLevelEquivalency {
  id:                string;
  country_a:         string;
  class_level_a:     string;
  country_b:         string;
  class_level_b:     string;
  equivalency_score: number;
}

export interface SubjectEquivalency {
  id:              string;
  country_a:       string;
  subject_a:       string;
  country_b:       string;
  subject_b:       string;
  similarity_score: number;
}

export interface CrosswalkSummary {
  similarity_score:     number;
  matched_pairs:        number;
  matched_objectives:   number;
  total_source:         number;
  class_level_mappings: number;
  subject_mappings:     number;
}

export interface LocalizedLesson {
  localized_lesson_id: string | null;
  title:               string;
  target_country:      string;
  target_subject:      string;
  target_class_level:  string;
  localization_notes:  string;
  content:             any;
}

// ── Supported countries ───────────────────────────────────────────────────────

export const AFRICAN_COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'Cameroon', 'Tanzania', 'Rwanda',
  'Uganda', 'South Africa', 'Senegal', 'Ethiopia', "Côte d'Ivoire",
  'Zimbabwe', 'Zambia', 'Malawi', 'Mozambique', 'Botswana',
] as const;

// ── Crosswalk generation ──────────────────────────────────────────────────────

export async function generateCrosswalk(
  sourceCountry: string,
  targetCountry: string,
  subject?: string,
): Promise<CrosswalkSummary> {
  const { data, error } = await supabase.functions.invoke('curriculum-crosswalk-generate', {
    body: { sourceCountry, targetCountry, subject: subject ?? null },
  });
  if (error || !data?.success) throw new Error(error?.message ?? 'Crosswalk generation failed');
  return data as CrosswalkSummary;
}

// ── Crosswalk queries ─────────────────────────────────────────────────────────

export async function getCrosswalkMatches(
  sourceCountry: string,
  targetCountry: string,
  minScore = 60,
): Promise<CrosswalkMatch[]> {
  const { data } = await supabase
    .from('curriculum_crosswalk')
    .select(`
      *,
      source_obj:source_objective_id(learning_objective, topic, class_level),
      target_obj:target_objective_id(learning_objective, topic, class_level)
    `)
    .eq('source_country', sourceCountry)
    .eq('target_country', targetCountry)
    .gte('similarity_score', minScore)
    .order('similarity_score', { ascending: false })
    .limit(100);

  return (data ?? []).map((r: any) => ({
    ...r,
    source_text:        r.source_obj?.learning_objective,
    source_topic:       r.source_obj?.topic,
    source_class_level: r.source_obj?.class_level,
    target_text:        r.target_obj?.learning_objective,
    target_topic:       r.target_obj?.topic,
    target_class_level: r.target_obj?.class_level,
  }));
}

export async function getSimilarityMatrix(): Promise<SimilarityIndex[]> {
  const { data } = await supabase
    .from('curriculum_similarity_index')
    .select('*')
    .eq('subject', '')
    .order('similarity_score', { ascending: false });
  return (data ?? []) as SimilarityIndex[];
}

export async function getClassLevelEquivalency(
  countryA: string,
  countryB: string,
): Promise<ClassLevelEquivalency[]> {
  const { data } = await supabase
    .from('class_level_equivalency')
    .select('*')
    .eq('country_a', countryA)
    .eq('country_b', countryB)
    .order('equivalency_score', { ascending: false });
  return (data ?? []) as ClassLevelEquivalency[];
}

export async function getSubjectEquivalency(
  countryA: string,
  countryB: string,
): Promise<SubjectEquivalency[]> {
  const { data } = await supabase
    .from('subject_equivalency')
    .select('*')
    .eq('country_a', countryA)
    .eq('country_b', countryB)
    .order('similarity_score', { ascending: false });
  return (data ?? []) as SubjectEquivalency[];
}

// ── Lesson localization ───────────────────────────────────────────────────────

export async function localizeLesson(
  lessonNoteId: string,
  targetCountry: string,
  teacherId: string,
): Promise<LocalizedLesson> {
  const { data, error } = await supabase.functions.invoke('lesson-localize', {
    body: { lessonNoteId, targetCountry, teacherId },
  });
  if (error || !data?.success) throw new Error(error?.message ?? 'Lesson localization failed');
  return data as LocalizedLesson;
}

// ── Embed objectives for a country ────────────────────────────────────────────

export async function embedObjectivesForCountry(
  country: string,
  subject?: string,
): Promise<{ embedded: number; failed: number; total: number }> {
  const { data, error } = await supabase.functions.invoke('curriculum-embed-objectives', {
    body: { country, subject: subject ?? null },
  });
  if (error || !data?.success) throw new Error(error?.message ?? 'Embedding failed');
  return data;
}
