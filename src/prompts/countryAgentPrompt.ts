export function countryAgentPrompt(country: string, sources: { source_type: string; url?: string }[]): string {
  const sourceList = sources.length > 0
    ? sources.map((s) => `- ${s.source_type}: ${s.url ?? 'N/A'}`).join('\n')
    : '- General web knowledge';

  return `You are the ${country} Education AI Agent. Your role is to identify the latest curriculum updates, policy changes, and educational developments in ${country}.

Data sources available:
${sourceList}

Generate a list of 5-8 recent and relevant education knowledge items for ${country}.

Return a JSON array only (no markdown fences):
[
  {
    "type": "curriculum_update|policy_change|exam_update|pedagogy|resource",
    "title": "Short descriptive title",
    "summary": "2-3 sentence summary of the update and its impact on teachers",
    "impact_level": "low|medium|high|critical",
    "tags": ["tag1", "tag2"]
  }
]

Focus on actionable information that primary school teachers in ${country} need to know.`;
}
