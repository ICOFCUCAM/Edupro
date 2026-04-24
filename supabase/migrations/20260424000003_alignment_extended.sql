-- ============================================================
-- EduPro — Alignment Extended: More seed data + change tracking
-- ============================================================

-- ── Add school alignment columns to lesson_alignment_scores ─
alter table public.lesson_alignment_scores
  add column if not exists school_alignment_score  integer check (school_alignment_score between 0 and 100),
  add column if not exists school_matched_objectives text[] default null,
  add column if not exists school_missing_objectives text[] default null;

-- ── Curriculum change log ─────────────────────────────────
-- Tracks when curriculum_objectives are added/updated so
-- affected lessons can be rescored and teachers notified.
create table if not exists public.curriculum_change_log (
  id           uuid primary key default gen_random_uuid(),
  country      text not null,
  subject      text,
  class_level  text,
  change_type  text not null check (change_type in ('added', 'updated', 'removed')),
  description  text,
  changed_by   uuid references public.teachers(id) on delete set null,
  created_at   timestamptz default now()
);

alter table public.curriculum_change_log enable row level security;

create policy "change_log_select" on public.curriculum_change_log
  for select to authenticated using (true);

create index if not exists idx_change_log_country
  on public.curriculum_change_log (country, created_at desc);

-- ── Extended seed data ────────────────────────────────────

insert into public.curriculum_objectives
  (country, subject, class_level, topic, learning_objective, term, week, strand, source_label)
values

-- ───────── Nigeria Primary 5 & 6 ─────────────────────────
('Nigeria', 'Mathematics', 'Primary 5', 'Fractions', 'Add and subtract fractions with unlike denominators', 'Term 1', 1, 'Fractions', 'NCC 2023'),
('Nigeria', 'Mathematics', 'Primary 5', 'Decimals', 'Multiply and divide decimal numbers by 10, 100, 1000', 'Term 1', 3, 'Decimals', 'NCC 2023'),
('Nigeria', 'Mathematics', 'Primary 5', 'Percentages', 'Calculate percentages of whole numbers in real-life contexts', 'Term 2', 1, 'Percentages', 'NCC 2023'),
('Nigeria', 'Mathematics', 'Primary 5', 'Area and Perimeter', 'Calculate the area and perimeter of rectangles and triangles', 'Term 2', 3, 'Measurement', 'NCC 2023'),
('Nigeria', 'Mathematics', 'Primary 6', 'Ratio and Proportion', 'Solve problems involving ratio and direct proportion', 'Term 1', 2, 'Number', 'NCC 2023'),
('Nigeria', 'Mathematics', 'Primary 6', 'Algebra', 'Find the value of unknown quantities in simple equations', 'Term 1', 4, 'Algebra', 'NCC 2023'),
('Nigeria', 'Mathematics', 'Primary 6', 'Statistics', 'Collect, organise and interpret data in bar charts and pie charts', 'Term 2', 2, 'Statistics', 'NCC 2023'),
('Nigeria', 'English Language', 'Primary 5', 'Comprehension', 'Identify theme, plot and character in a narrative text', 'Term 1', 1, 'Reading', 'NCC 2023'),
('Nigeria', 'English Language', 'Primary 5', 'Essay Writing', 'Write a well-structured narrative essay with at least 3 paragraphs', 'Term 2', 1, 'Writing', 'NCC 2023'),
('Nigeria', 'English Language', 'Primary 5', 'Grammar', 'Use pronouns, prepositions and conjunctions correctly in sentences', 'Term 1', 3, 'Grammar', 'NCC 2023'),
('Nigeria', 'English Language', 'Primary 6', 'Comprehension', 'Distinguish between fact, opinion and inference in expository texts', 'Term 1', 2, 'Reading', 'NCC 2023'),
('Nigeria', 'English Language', 'Primary 6', 'Essay Writing', 'Write a formal letter and an argumentative essay', 'Term 2', 2, 'Writing', 'NCC 2023'),
('Nigeria', 'Basic Science', 'Primary 5', 'Ecology', 'Describe food chains and food webs in ecosystems', 'Term 1', 2, 'Life Science', 'NCC 2023'),
('Nigeria', 'Basic Science', 'Primary 5', 'Matter', 'Classify matter into solids, liquids and gases by their properties', 'Term 1', 4, 'Physical Science', 'NCC 2023'),
('Nigeria', 'Basic Science', 'Primary 5', 'Simple Machines', 'Identify six types of simple machines and their uses', 'Term 2', 2, 'Technology', 'NCC 2023'),
('Nigeria', 'Basic Science', 'Primary 6', 'Reproduction', 'Explain asexual and sexual reproduction in plants and animals', 'Term 1', 1, 'Life Science', 'NCC 2023'),
('Nigeria', 'Basic Science', 'Primary 6', 'Energy', 'Describe different forms of energy and energy transformations', 'Term 1', 3, 'Physical Science', 'NCC 2023'),
('Nigeria', 'Social Studies', 'Primary 3', 'Family and Community', 'Describe the roles and responsibilities of family members', 'Term 1', 1, 'Society', 'NCC 2023'),
('Nigeria', 'Social Studies', 'Primary 4', 'Government', 'Identify the three tiers of government in Nigeria', 'Term 1', 2, 'Civics', 'NCC 2023'),
('Nigeria', 'Social Studies', 'Primary 5', 'Natural Resources', 'Identify Nigeria''s natural resources and their economic importance', 'Term 1', 1, 'Economics', 'NCC 2023'),
('Nigeria', 'Basic Technology', 'Primary 4', 'Drawing', 'Produce freehand sketches and simple drawings of objects', 'Term 1', 1, 'Technical Drawing', 'NCC 2023'),
('Nigeria', 'Basic Technology', 'Primary 5', 'Electronics', 'Identify basic electronic components and their symbols', 'Term 2', 1, 'Electronics', 'NCC 2023'),

-- ───────── Ghana Primary 5 & 6 ────────────────────────────
('Ghana', 'Mathematics', 'Primary 5', 'Number Operations', 'Multiply and divide numbers up to 5 digits by 2-digit numbers', 'Term 1', 1, 'Number', 'CBC 2019'),
('Ghana', 'Mathematics', 'Primary 5', 'Fractions, Decimals & Percentages', 'Add, subtract and compare fractions and decimals', 'Term 1', 3, 'Number', 'CBC 2019'),
('Ghana', 'Mathematics', 'Primary 6', 'Algebra', 'Write and solve simple algebraic expressions and equations', 'Term 1', 1, 'Algebra', 'CBC 2019'),
('Ghana', 'Mathematics', 'Primary 6', 'Geometry', 'Calculate area, perimeter and volume of 2D and 3D shapes', 'Term 2', 1, 'Geometry', 'CBC 2019'),
('Ghana', 'English Language', 'Primary 5', 'Listening & Speaking', 'Summarise and retell information from spoken texts', 'Term 1', 1, 'Oral Language', 'CBC 2019'),
('Ghana', 'English Language', 'Primary 5', 'Writing', 'Write persuasive texts using evidence and logical arguments', 'Term 2', 2, 'Writing', 'CBC 2019'),
('Ghana', 'English Language', 'Primary 6', 'Reading', 'Analyse the structure and language features of different text types', 'Term 1', 1, 'Reading', 'CBC 2019'),
('Ghana', 'Science', 'Primary 4', 'Living Things', 'Classify living organisms into kingdoms with examples', 'Term 1', 1, 'Biology', 'CBC 2019'),
('Ghana', 'Science', 'Primary 5', 'Forces and Energy', 'Describe gravitational, magnetic and frictional forces', 'Term 1', 2, 'Physics', 'CBC 2019'),
('Ghana', 'Science', 'Primary 6', 'Earth and Environment', 'Explain causes and effects of climate change and global warming', 'Term 1', 1, 'Earth Science', 'CBC 2019'),
('Ghana', 'Our World Our People', 'Primary 4', 'Ghana''s History', 'Describe major events in Ghana''s pre-colonial and colonial history', 'Term 1', 1, 'History', 'CBC 2019'),
('Ghana', 'Our World Our People', 'Primary 5', 'Governance', 'Explain the structure of Ghana''s government and democracy', 'Term 1', 2, 'Civics', 'CBC 2019'),

-- ───────── Kenya CBC Grade 3–6 ────────────────────────────
('Kenya', 'Mathematics', 'Grade 3', 'Numbers', 'Read, write and count whole numbers up to 9999', 'Term 1', 1, 'Numbers', 'Kenya CBC 2017'),
('Kenya', 'Mathematics', 'Grade 3', 'Addition', 'Add numbers with regrouping up to 3 digits', 'Term 1', 2, 'Numbers', 'Kenya CBC 2017'),
('Kenya', 'Mathematics', 'Grade 3', 'Measurement', 'Measure and compare length, mass and capacity using standard units', 'Term 2', 1, 'Measurement', 'Kenya CBC 2017'),
('Kenya', 'Mathematics', 'Grade 5', 'Numbers', 'Read, write and use numbers up to 1,000,000', 'Term 1', 1, 'Numbers', 'Kenya CBC 2017'),
('Kenya', 'Mathematics', 'Grade 5', 'Decimals', 'Add, subtract and multiply decimals to 2 decimal places', 'Term 1', 3, 'Numbers', 'Kenya CBC 2017'),
('Kenya', 'Mathematics', 'Grade 6', 'Ratio and Proportion', 'Solve problems involving ratio, rate and proportion', 'Term 1', 1, 'Numbers', 'Kenya CBC 2017'),
('Kenya', 'Mathematics', 'Grade 6', 'Algebra', 'Simplify algebraic expressions and solve linear equations', 'Term 2', 1, 'Algebra', 'Kenya CBC 2017'),
('Kenya', 'English', 'Grade 3', 'Listening and Speaking', 'Follow multi-step oral instructions and respond appropriately', 'Term 1', 1, 'Oral Communication', 'Kenya CBC 2017'),
('Kenya', 'English', 'Grade 5', 'Writing', 'Write a structured composition with introduction, body and conclusion', 'Term 2', 1, 'Writing', 'Kenya CBC 2017'),
('Kenya', 'English', 'Grade 6', 'Grammar', 'Use reported speech, relative clauses and passive voice correctly', 'Term 1', 2, 'Language Use', 'Kenya CBC 2017'),
('Kenya', 'Integrated Science', 'Grade 4', 'Living Things', 'Classify plants and animals based on observable characteristics', 'Term 1', 1, 'Biology', 'Kenya CBC 2017'),
('Kenya', 'Integrated Science', 'Grade 5', 'Matter', 'Investigate properties and changes of solids, liquids and gases', 'Term 1', 2, 'Chemistry', 'Kenya CBC 2017'),
('Kenya', 'Integrated Science', 'Grade 6', 'Energy', 'Explore different sources of energy and their environmental impact', 'Term 1', 1, 'Physics', 'Kenya CBC 2017'),
('Kenya', 'Social Studies', 'Grade 4', 'Our Environment', 'Describe physical features and climate of Kenya''s regions', 'Term 1', 1, 'Geography', 'Kenya CBC 2017'),
('Kenya', 'Social Studies', 'Grade 5', 'Governance', 'Explain Kenya''s system of government and citizens'' rights', 'Term 1', 2, 'Civics', 'Kenya CBC 2017'),

-- ───────── South Africa CAPS ──────────────────────────────
('South Africa', 'Mathematics', 'Grade 3', 'Whole Numbers', 'Count, order, compare and represent numbers to 999', 'Term 1', 1, 'Numbers Operations & Relationships', 'CAPS 2012'),
('South Africa', 'Mathematics', 'Grade 4', 'Whole Numbers', 'Count, order, compare whole numbers to at least 10,000', 'Term 1', 1, 'Numbers Operations & Relationships', 'CAPS 2012'),
('South Africa', 'Mathematics', 'Grade 4', 'Common Fractions', 'Recognise fractions in diagrammatic form and as part of a whole', 'Term 2', 1, 'Numbers Operations & Relationships', 'CAPS 2012'),
('South Africa', 'Mathematics', 'Grade 5', 'Multiplication', 'Multiply at least whole 3-digit by 2-digit numbers', 'Term 1', 2, 'Numbers Operations & Relationships', 'CAPS 2012'),
('South Africa', 'Mathematics', 'Grade 6', 'Ratio and Rate', 'Describe and compare two quantities using ratio and rate', 'Term 1', 3, 'Numbers Operations & Relationships', 'CAPS 2012'),
('South Africa', 'Mathematics', 'Grade 7', 'Integers', 'Add, subtract, multiply and divide with integers', 'Term 1', 1, 'Numbers Operations & Relationships', 'CAPS 2012'),
('South Africa', 'English Home Language', 'Grade 4', 'Reading & Viewing', 'Read for information and answer comprehension questions', 'Term 1', 1, 'Reading & Viewing', 'CAPS 2012'),
('South Africa', 'English Home Language', 'Grade 5', 'Writing & Presenting', 'Plan, draft and edit a narrative or descriptive essay', 'Term 2', 1, 'Writing & Presenting', 'CAPS 2012'),
('South Africa', 'Natural Sciences', 'Grade 4', 'Life and Living', 'Describe basic life processes: nutrition, movement, reproduction', 'Term 1', 1, 'Life Sciences', 'CAPS 2012'),
('South Africa', 'Natural Sciences', 'Grade 5', 'Matter and Materials', 'Classify materials as conductors or insulators of heat and electricity', 'Term 2', 1, 'Physical Sciences', 'CAPS 2012'),
('South Africa', 'Natural Sciences', 'Grade 6', 'Energy and Change', 'Explain how energy is transferred and transformed in systems', 'Term 1', 2, 'Physical Sciences', 'CAPS 2012'),
('South Africa', 'Social Sciences', 'Grade 4', 'Geography', 'Describe maps, atlases and globes as tools for understanding place', 'Term 1', 1, 'Geography', 'CAPS 2012'),
('South Africa', 'Social Sciences', 'Grade 5', 'History', 'Describe how early African kingdoms were organised and governed', 'Term 1', 1, 'History', 'CAPS 2012'),

-- ───────── Uganda NCDC P4–P7 ──────────────────────────────
('Uganda', 'Mathematics', 'P4', 'Numbers', 'Read, write and count numbers up to 100,000', 'Term 1', 1, 'Numbers', 'NCDC Uganda 2018'),
('Uganda', 'Mathematics', 'P5', 'Fractions', 'Add and subtract fractions with same and different denominators', 'Term 1', 2, 'Numbers', 'NCDC Uganda 2018'),
('Uganda', 'Mathematics', 'P6', 'Ratio', 'Solve problems involving ratio and proportion', 'Term 1', 1, 'Numbers', 'NCDC Uganda 2018'),
('Uganda', 'Mathematics', 'P7', 'Algebra', 'Solve simple linear equations with one unknown', 'Term 1', 2, 'Algebra', 'NCDC Uganda 2018'),
('Uganda', 'English', 'P4', 'Reading', 'Read and comprehend narrative and informational texts', 'Term 1', 1, 'Literacy', 'NCDC Uganda 2018'),
('Uganda', 'English', 'P5', 'Writing', 'Write a structured composition of at least two paragraphs', 'Term 2', 1, 'Literacy', 'NCDC Uganda 2018'),
('Uganda', 'Science', 'P4', 'Living Things', 'Distinguish between living and non-living things', 'Term 1', 1, 'Biology', 'NCDC Uganda 2018'),
('Uganda', 'Science', 'P5', 'Human Body', 'Describe the major organs and their functions', 'Term 1', 2, 'Biology', 'NCDC Uganda 2018'),
('Uganda', 'Social Studies', 'P4', 'Our Community', 'Identify different communities and their cultural practices', 'Term 1', 1, 'Geography & Civics', 'NCDC Uganda 2018'),
('Uganda', 'Social Studies', 'P5', 'Uganda''s History', 'Describe pre-colonial kingdoms of Uganda', 'Term 1', 1, 'History', 'NCDC Uganda 2018'),

-- ───────── Rwanda CBC P3–P6 ───────────────────────────────
('Rwanda', 'Mathematics', 'P3', 'Whole Numbers', 'Read, write and order numbers up to 9,999', 'Term 1', 1, 'Numbers', 'Rwanda CBC REB 2016'),
('Rwanda', 'Mathematics', 'P4', 'Operations', 'Multiply and divide 3-digit numbers by 1-digit numbers', 'Term 1', 1, 'Numbers', 'Rwanda CBC REB 2016'),
('Rwanda', 'Mathematics', 'P5', 'Fractions', 'Compare and order fractions, and solve fraction problems', 'Term 1', 2, 'Numbers', 'Rwanda CBC REB 2016'),
('Rwanda', 'Mathematics', 'P6', 'Geometry', 'Calculate the area of triangles, parallelograms and composite shapes', 'Term 2', 1, 'Geometry', 'Rwanda CBC REB 2016'),
('Rwanda', 'English', 'P3', 'Reading', 'Read and decode words using phonics knowledge', 'Term 1', 1, 'Language Arts', 'Rwanda CBC REB 2016'),
('Rwanda', 'English', 'P5', 'Writing', 'Write different text types: stories, descriptions, reports', 'Term 2', 1, 'Language Arts', 'Rwanda CBC REB 2016'),
('Rwanda', 'Sciences', 'P4', 'Living Things', 'Describe characteristics of living things and classification', 'Term 1', 1, 'Life Sciences', 'Rwanda CBC REB 2016'),
('Rwanda', 'Sciences', 'P5', 'Energy', 'Identify different forms of energy and their uses', 'Term 1', 2, 'Physical Sciences', 'Rwanda CBC REB 2016'),

-- ───────── Tanzania TIE Standard 3–6 ─────────────────────
('Tanzania', 'Hisabati/Mathematics', 'Standard 3', 'Namba/Numbers', 'Soma, andika na hesabu namba hadi 999 (Read, write, count up to 999)', 'Term 1', 1, 'Namba', 'TIE Tanzania 2016'),
('Tanzania', 'Hisabati/Mathematics', 'Standard 4', 'Namba/Numbers', 'Fanya mahesabu ya msingi: kuongeza, kutoa, kuzidisha na kugawanya', 'Term 1', 1, 'Namba', 'TIE Tanzania 2016'),
('Tanzania', 'Hisabati/Mathematics', 'Standard 5', 'Sehemu/Fractions', 'Ongeza na toa sehemu za kawaida zenye nambari sawa', 'Term 1', 2, 'Namba', 'TIE Tanzania 2016'),
('Tanzania', 'English', 'Standard 3', 'Reading', 'Read simple sentences and short paragraphs with comprehension', 'Term 1', 1, 'Literacy', 'TIE Tanzania 2016'),
('Tanzania', 'English', 'Standard 5', 'Writing', 'Write short compositions on familiar topics', 'Term 2', 1, 'Literacy', 'TIE Tanzania 2016'),
('Tanzania', 'Science', 'Standard 4', 'Living Things', 'Classify living things as plants or animals and describe their needs', 'Term 1', 1, 'Biology', 'TIE Tanzania 2016'),
('Tanzania', 'Science', 'Standard 6', 'Energy', 'Describe forms of energy and identify renewable and non-renewable sources', 'Term 1', 1, 'Physics', 'TIE Tanzania 2016'),
('Tanzania', 'Social Studies', 'Standard 4', 'Tanzania Geography', 'Describe Tanzania''s physical features: mountains, lakes and rivers', 'Term 1', 1, 'Geography', 'TIE Tanzania 2016'),

-- ───────── Ethiopia Grade 3–6 ─────────────────────────────
('Ethiopia', 'Mathematics', 'Grade 3', 'Whole Numbers', 'Read, write and order whole numbers up to 9,999', 'Term 1', 1, 'Numbers', 'ENCP Ethiopia 2020'),
('Ethiopia', 'Mathematics', 'Grade 4', 'Operations', 'Multiply and divide by 2-digit numbers with regrouping', 'Term 1', 2, 'Numbers', 'ENCP Ethiopia 2020'),
('Ethiopia', 'Mathematics', 'Grade 5', 'Fractions', 'Add, subtract and multiply common fractions', 'Term 1', 1, 'Numbers', 'ENCP Ethiopia 2020'),
('Ethiopia', 'Mathematics', 'Grade 6', 'Ratio', 'Use ratio and proportion to solve real-life problems', 'Term 1', 2, 'Numbers', 'ENCP Ethiopia 2020'),
('Ethiopia', 'English', 'Grade 4', 'Reading', 'Read and understand texts of 200–300 words', 'Term 1', 1, 'Reading', 'ENCP Ethiopia 2020'),
('Ethiopia', 'English', 'Grade 5', 'Writing', 'Write structured paragraphs with topic and supporting sentences', 'Term 2', 1, 'Writing', 'ENCP Ethiopia 2020'),
('Ethiopia', 'Environmental Science', 'Grade 3', 'Living Things', 'Identify plants and animals in the local environment', 'Term 1', 1, 'Biology', 'ENCP Ethiopia 2020'),
('Ethiopia', 'Environmental Science', 'Grade 5', 'Human Body', 'Describe the digestive, respiratory and circulatory systems', 'Term 1', 1, 'Biology', 'ENCP Ethiopia 2020'),

-- ───────── Senegal Curriculum ─────────────────────────────
('Senegal', 'Mathématiques', 'CE1', 'Numération', 'Lire, écrire et comparer des nombres jusqu''à 999', 'Trimestre 1', 1, 'Nombres', 'MENA Sénégal 2013'),
('Senegal', 'Mathématiques', 'CE2', 'Opérations', 'Poser et effectuer les 4 opérations sur les nombres entiers', 'Trimestre 1', 1, 'Nombres', 'MENA Sénégal 2013'),
('Senegal', 'Mathématiques', 'CM1', 'Fractions', 'Comparer et ordonner des fractions simples', 'Trimestre 1', 2, 'Nombres', 'MENA Sénégal 2013'),
('Senegal', 'Français', 'CE1', 'Lecture', 'Lire et comprendre un texte court à voix haute', 'Trimestre 1', 1, 'Lecture', 'MENA Sénégal 2013'),
('Senegal', 'Français', 'CM1', 'Rédaction', 'Rédiger un court texte narratif avec introduction et conclusion', 'Trimestre 2', 1, 'Production écrite', 'MENA Sénégal 2013'),
('Senegal', 'Sciences', 'CE2', 'Le vivant', 'Distinguer les êtres vivants des objets non vivants', 'Trimestre 1', 1, 'Sciences de la vie', 'MENA Sénégal 2013'),

-- ───────── DRC / Congo ────────────────────────────────────
('DRC', 'Mathématiques', '2ème Primaire', 'Numération', 'Lire, écrire et comparer des nombres jusqu''à 100', 'Trimestre 1', 1, 'Nombres', 'EPSP RDC'),
('DRC', 'Mathématiques', '4ème Primaire', 'Opérations', 'Effectuer des multiplications et des divisions simples', 'Trimestre 1', 2, 'Nombres', 'EPSP RDC'),
('DRC', 'Français', '3ème Primaire', 'Lecture', 'Lire un texte de 100 mots avec expression et compréhension', 'Trimestre 1', 1, 'Lecture', 'EPSP RDC'),
('DRC', 'Sciences', '4ème Primaire', 'La nature', 'Classer les animaux en groupes selon leurs caractéristiques', 'Trimestre 1', 1, 'Biologie', 'EPSP RDC'),

-- ───────── Cameroon extended ──────────────────────────────
('Cameroon', 'Mathematics', 'Class 3', 'Numbers', 'Read, write and compare numbers up to 9,999', 'Term 1', 1, 'Numbers', 'MINEDUB 2020'),
('Cameroon', 'Mathematics', 'Class 4', 'Operations', 'Multiply 3-digit numbers by 1-digit numbers with and without regrouping', 'Term 1', 1, 'Numbers', 'MINEDUB 2020'),
('Cameroon', 'Mathematics', 'Class 5', 'Fractions', 'Add and subtract fractions with unlike denominators', 'Term 1', 2, 'Numbers', 'MINEDUB 2020'),
('Cameroon', 'English', 'Class 3', 'Reading', 'Read and comprehend short stories and informational texts', 'Term 1', 1, 'Literacy', 'MINEDUB 2020'),
('Cameroon', 'English', 'Class 5', 'Writing', 'Write a structured paragraph with topic sentence and supporting details', 'Term 2', 1, 'Literacy', 'MINEDUB 2020'),
('Cameroon', 'Sciences', 'Class 4', 'Living Things', 'Identify the parts of a plant and describe their functions', 'Term 1', 1, 'Life Science', 'MINEDUB 2020'),
('Cameroon', 'Sciences', 'Class 5', 'Human Body', 'Name the major body systems and describe their roles', 'Term 1', 2, 'Life Science', 'MINEDUB 2020'),
('Cameroon', 'French', 'CM2', 'Grammaire', 'Identifier et utiliser les temps du passé: passé composé et imparfait', 'Trimestre 1', 1, 'Grammaire', 'MINEDUB 2020'),
('Cameroon', 'Mathématiques', 'CM2', 'Géométrie', 'Calculer l''aire et le périmètre de figures planes', 'Trimestre 2', 1, 'Géométrie', 'MINEDUB 2020')

on conflict do nothing;
