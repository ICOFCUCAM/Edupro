export function curriculumAnalyzerPrompt(country: string, documentText: string): string {
  return `You are a curriculum analysis expert for ${country}'s education system.

Analyze the following curriculum document and extract structured insights:

---
${documentText.slice(0, 4000)}
---

Extract and return a JSON object:
{
  "country": "${country}",
  "document_type": "curriculum|policy|exam|guideline|other",
  "key_changes": ["change 1", "change 2"],
  "affected_subjects": ["subject1", "subject2"],
  "affected_levels": ["level1", "level2"],
  "effective_date": "YYYY-MM-DD or null",
  "impact_level": "low|medium|high|critical",
  "teacher_actions": ["action teachers should take"],
  "summary": "2-3 sentence overall summary"
}

Return only the JSON object, no markdown.`;
}

export function trendAnalysisPrompt(country: string, items: { title: string; summary: string }[]): string {
  const itemList = items.map((i, n) => `${n + 1}. ${i.title}: ${i.summary}`).join('\n');
  return `Analyze these ${country} education updates and identify cross-cutting themes:

${itemList}

Return 3 key trends as a JSON array:
[{ "theme": "...", "evidence": "...", "recommendation": "..." }]`;
}
