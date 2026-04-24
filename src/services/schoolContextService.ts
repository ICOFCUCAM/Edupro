import { getSchoolKnowledgeItems, getSchoolLessons } from './organizationService';

export interface SchoolContext {
  schoolName: string;
  recentTopics: string[];
  schemeOfWork: string[];
  curriculumNotes: string[];
}

/**
 * Builds a compact school context string to inject into AI lesson generation prompts.
 * Returns null when the teacher has no school affiliation.
 */
export async function buildSchoolContextPrompt(
  organizationId: string,
  organizationName: string
): Promise<string | null> {
  const [knowledgeItems, recentLessons] = await Promise.all([
    getSchoolKnowledgeItems(organizationId),
    getSchoolLessons(organizationId, undefined),
  ]);

  if (!knowledgeItems.length && !recentLessons.length) return null;

  const sections: string[] = [`School: ${organizationName}`];

  // Scheme of work entries
  const schemes = knowledgeItems.filter(k => k.content_type === 'scheme_of_work');
  if (schemes.length) {
    sections.push(
      'Scheme of Work / Curriculum Notes:\n' +
      schemes.slice(0, 5).map(k => `- ${k.title}${k.summary ? `: ${k.summary}` : ''}`).join('\n')
    );
  }

  // General knowledge items (AI insights, documents)
  const notes = knowledgeItems.filter(k => k.content_type !== 'scheme_of_work');
  if (notes.length) {
    sections.push(
      'Internal Curriculum Adaptations:\n' +
      notes.slice(0, 5).map(k => `- ${k.title}${k.summary ? `: ${k.summary}` : ''}`).join('\n')
    );
  }

  // Recent lesson topics from this school
  if (recentLessons.length) {
    const recent = recentLessons.slice(0, 8);
    const topicList = [...new Set(recent.map((l: any) => `${l.subject}: ${l.topic}`))];
    sections.push('Recently Generated Topics at This School:\n' + topicList.map(t => `- ${t}`).join('\n'));
  }

  return (
    '--- School Context (align lesson to this school\'s curriculum) ---\n' +
    sections.join('\n\n') +
    '\n--- End School Context ---'
  );
}

/**
 * Returns a short summary string for UI display (e.g. "3 knowledge items, 12 lessons").
 */
export async function getSchoolContextSummary(organizationId: string): Promise<string> {
  const [ki, ls] = await Promise.all([
    getSchoolKnowledgeItems(organizationId),
    getSchoolLessons(organizationId),
  ]);
  const parts: string[] = [];
  if (ki.length) parts.push(`${ki.length} knowledge item${ki.length !== 1 ? 's' : ''}`);
  if (ls.length) parts.push(`${ls.length} school lesson${ls.length !== 1 ? 's' : ''}`);
  return parts.join(', ') || 'No school data yet';
}
