import { supabase } from '@/lib/supabase';

export interface VoiceContext {
  curriculumObjectives: string;   // bullet-list of objectives for current subject/class
  knowledgeSnippets:    string[]; // country-specific KB entries
  objectiveCount:       number;
}

// Country knowledge base — mirrors KB_ENTRIES in KnowledgeBase.tsx but structured for voice
const COUNTRY_KNOWLEDGE: Record<string, string[]> = {
  Nigeria: [
    'NERDC 2025 Revised Primary Curriculum: digital literacy is a core subject from Primary 3. All lesson notes should incorporate ICT integration objectives.',
    'WAEC/NECO standards: structure exams with essays, objective questions, and practical skills sections.',
    'Universal Basic Education (UBE) framework mandates free, compulsory 9-year basic education.',
  ],
  Ghana: [
    'NaCCA Activity-Based Learning Guidelines 2025: at least 60% of lesson time should be student-led activities. Assessment should be formative and continuous.',
    'Ghana NaCCA Standard-Based Curriculum uses strand-based teaching with performance indicators per lesson.',
    'BECE and WASSCE guide upper secondary assessment formats — include past-question style practice.',
  ],
  Kenya: [
    'CBC Formative Assessment Framework 2025: portfolio-based assessment alongside traditional testing. Rubrics required for competency evaluation.',
    "Kenya's CBC focuses on values, core competencies, and pertinent contemporary issues across all subjects.",
    'KNEC administers national examinations; align lessons to learning outcomes, not just content.',
  ],
  Cameroon: [
    'Bilingual Education Enhancement: lesson notes must include key vocabulary in both English and French for Anglophone and Francophone regions.',
    'Cameroon follows national curriculum with specific attainment targets per cycle and official exams (GCE, BEPC).',
    'The Cameroon Ministry of Secondary Education requires lesson plans filed with school administration.',
  ],
  Tanzania: [
    'TIE Continuous Assessment Guidelines: weekly assessments should be documented and contribute 40% to final grades.',
    'Tanzania NECTA governs national exams; KCSE-equivalent format at secondary level.',
    'Tanzania Institute of Education (TIE) sets national curriculum; Kiswahili is mandatory across all subjects.',
  ],
  Rwanda: [
    'Rwanda Education Board CBC: integrate gender, environment, peace education, and financial literacy in all lesson plans.',
    'Rwanda CBC emphasises critical thinking, creativity, and entrepreneurship as cross-cutting competencies.',
    'REB requires competency-based lesson planning with clear observable outcomes per lesson.',
  ],
  Uganda: [
    'NCDC Inclusive Education Policy: differentiated instruction strategies required in every lesson plan with accommodations for learners with special needs.',
    "Uganda's Lower Secondary Curriculum (LSC) emphasises competency-based learning since 2020.",
    'UNEB administers national examinations; PLE, UCE, and UACE formats guide assessment design.',
  ],
  'South Africa': [
    'CAPS Amendment: indigenous knowledge systems must be integrated across all subjects. Reference local cultural practices.',
    'South Africa CAPS specifies Annual Teaching Plans (ATPs) for each grade and subject; adherence is compulsory.',
    'DBE assessment policy: formal and informal tasks, term-end exams, and School-Based Assessment (SBA).',
  ],
  Senegal: [
    "Approche Par Compétences (APC): lesson plans must define compétences, situations d'apprentissage, and integration activities.",
    'Sénégal Ministry of Education requires lesson notes (fiches pédagogiques) submitted to school director.',
    'French is the medium of instruction; local languages (Wolof etc.) encouraged as bridges in primary.',
  ],
  Ethiopia: [
    'Mother Tongue Education Policy: mother-tongue instruction covers Grades 1–6 in all regions. Lesson notes should be available in regional languages alongside English/Amharic.',
    'Ethiopian Ministry of Education competency framework guides lesson objective writing.',
  ],
  'Côte d\'Ivoire': [
    "Côte d'Ivoire follows francophone APC curriculum. Lesson notes must include compétences de base and critères d'évaluation.",
    'DREN/IEP inspectors conduct lesson supervision; maintain structured daily lesson plans.',
  ],
};

const DEFAULT_KNOWLEDGE = [
  'Align lessons to the national curriculum objectives for your country and subject.',
  'Use formative assessment strategies and provide clear learning objectives in every lesson.',
];

export async function loadVoiceContext(
  country: string,
  subject: string,
  classLevel: string,
): Promise<VoiceContext> {
  const knowledgeSnippets = COUNTRY_KNOWLEDGE[country] ?? DEFAULT_KNOWLEDGE;

  // Early return if subject/class not specified — no objectives to fetch
  if (!subject || !classLevel) {
    return { curriculumObjectives: '', knowledgeSnippets, objectiveCount: 0 };
  }

  try {
    const { data } = await supabase
      .from('curriculum_objectives')
      .select('learning_objective, topic')
      .eq('country', country)
      .eq('subject', subject)
      .eq('class_level', classLevel)
      .limit(25);

    if (!data?.length) {
      return { curriculumObjectives: '', knowledgeSnippets, objectiveCount: 0 };
    }

    const curriculumObjectives = data
      .map(o => `• [${o.topic}] ${o.learning_objective}`)
      .join('\n');

    return { curriculumObjectives, knowledgeSnippets, objectiveCount: data.length };
  } catch {
    return { curriculumObjectives: '', knowledgeSnippets, objectiveCount: 0 };
  }
}

export async function loadSchemeContext(organizationId: string): Promise<string> {
  if (!organizationId) return '';
  try {
    const { data } = await supabase
      .from('knowledge_items')
      .select('title, summary, content_type')
      .eq('organization_id', organizationId)
      .in('content_type', ['scheme_of_work', 'document'])
      .limit(5);

    if (!data?.length) return '';

    return data
      .map(k => `${k.title}${k.summary ? ': ' + k.summary.slice(0, 200) : ''}`)
      .join('\n---\n');
  } catch {
    return '';
  }
}
