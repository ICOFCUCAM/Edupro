import { supabase } from '@/lib/supabase';

export interface BulkSchoolRow {
  schoolName: string;
  district: string;
  country: string;
  teacherEmails?: string;
  subjects?: string;
  grades?: string;
}

export function parseCSV(csvText: string): BulkSchoolRow[] {
  const lines = csvText.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '')
  );

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return {
      schoolName: row['school_name'] || row['name'] || '',
      district: row['district'] || '',
      country: row['country'] || '',
      teacherEmails: row['teacher_emails'] || row['teachers'] || '',
      subjects: row['subjects'] || '',
      grades: row['grades'] || '',
    };
  }).filter(r => r.schoolName.trim());
}

async function findOrCreateOrg(name: string, country: string, type: string, parentId?: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', name)
    .eq('country', country)
    .eq('type', type)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('organizations')
    .insert({ name, country, type, parent_id: parentId || null })
    .select('id')
    .single();

  if (error) { console.error('findOrCreateOrg:', error); return null; }
  return created.id;
}

export interface BulkOnboardResult {
  created: number;
  skipped: number;
  errors: string[];
  schoolIds: string[];
}

export async function bulkCreateSchools(rows: BulkSchoolRow[]): Promise<BulkOnboardResult> {
  const errors: string[] = [];
  const schoolIds: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.schoolName || !row.country) {
      errors.push(`Row skipped — missing school name or country: "${row.schoolName}"`);
      skipped++;
      continue;
    }

    try {
      let districtId: string | undefined;

      if (row.district) {
        const id = await findOrCreateOrg(row.district, row.country, 'district');
        if (id) districtId = id;
      }

      const schoolId = await findOrCreateOrg(row.schoolName, row.country, 'school', districtId);

      if (!schoolId) {
        errors.push(`Failed to create school: ${row.schoolName}`);
        skipped++;
        continue;
      }

      schoolIds.push(schoolId);
      created++;
    } catch (e: any) {
      errors.push(`Error processing "${row.schoolName}": ${e.message}`);
      skipped++;
    }
  }

  return { created, skipped, errors, schoolIds };
}

export const CSV_TEMPLATE_HEADERS = 'School Name,District,Country,Teacher Emails,Subjects,Grades';
export const CSV_TEMPLATE_EXAMPLE = [
  CSV_TEMPLATE_HEADERS,
  'GBHS Bamenda,Northwest Region District,Cameroon,teacher1@example.com,Mathematics;English,Primary 4;Primary 5',
  'Sunrise Academy,Lagos State District,Nigeria,,Science;Social Studies,Primary 3',
].join('\n');
