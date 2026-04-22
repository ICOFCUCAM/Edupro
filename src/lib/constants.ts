export const REGIONS = [
  { id: 'west', name: 'West Africa', countries: ['Nigeria', 'Ghana', 'Senegal', 'Sierra Leone', 'Liberia', 'Gambia', 'Guinea', 'Mali', 'Burkina Faso', 'Niger', 'Togo', 'Benin', 'Ivory Coast'] },
  { id: 'central', name: 'Central Africa', countries: ['Cameroon', 'DRC', 'Congo', 'Gabon', 'Chad', 'Central African Republic', 'Equatorial Guinea'] },
  { id: 'east', name: 'East Africa', countries: ['Kenya', 'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Eritrea', 'Somalia', 'Burundi', 'South Sudan'] },
  { id: 'south', name: 'Southern Africa', countries: ['South Africa', 'Zimbabwe', 'Zambia', 'Mozambique', 'Malawi', 'Botswana', 'Namibia', 'Lesotho', 'Eswatini'] },
];

export const COUNTRIES_WITH_LEVELS: Record<string, { levels: string[]; curriculum: string }> = {
  'Nigeria': { levels: ['Nursery 1', 'Nursery 2', 'Nursery 3', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'], curriculum: 'NERDC National Curriculum' },
  'Ghana': { levels: ['KG1', 'KG2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'], curriculum: 'NaCCA Curriculum' },
  'Kenya': { levels: ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'], curriculum: 'CBC Curriculum' },
  'South Africa': { levels: ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'], curriculum: 'CAPS Curriculum' },
  'Cameroon': { levels: ['Nursery 1', 'Nursery 2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6'], curriculum: 'National Curriculum' },
  'Tanzania': { levels: ['Pre-Primary 1', 'Pre-Primary 2', 'Standard 1', 'Standard 2', 'Standard 3', 'Standard 4', 'Standard 5', 'Standard 6', 'Standard 7'], curriculum: 'TIE Curriculum' },
  'Uganda': { levels: ['Baby Class', 'Middle Class', 'Top Class', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'], curriculum: 'NCDC Curriculum' },
  'Rwanda': { levels: ['Nursery 1', 'Nursery 2', 'Nursery 3', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'], curriculum: 'CBC Curriculum' },
  'Ethiopia': { levels: ['KG1', 'KG2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'], curriculum: 'National Curriculum Framework' },
  'Senegal': { levels: ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], curriculum: 'Curriculum National' },
  'DRC': { levels: ['1ère Maternelle', '2ème Maternelle', '3ème Maternelle', '1ère Primaire', '2ème Primaire', '3ème Primaire', '4ème Primaire', '5ème Primaire', '6ème Primaire'], curriculum: 'Programme National EPSP' },
};

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'sw', name: 'Kiswahili', flag: '🇹🇿' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'am', name: 'Amharic', flag: '🇪🇹' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zu', name: 'isiZulu', flag: '🇿🇦' },
  { code: 'xh', name: 'isiXhosa', flag: '🇿🇦' },
  { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
  { code: 'rw', name: 'Kinyarwanda', flag: '🇷🇼' },
  { code: 'lg', name: 'Luganda', flag: '🇺🇬' },
  { code: 'wo', name: 'Wolof', flag: '🇸🇳' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'tw', name: 'Twi/Akan', flag: '🇬🇭' },
  { code: 'ln', name: 'Lingala', flag: '🇨🇩' },
];

export const SUBJECTS = [
  'Mathematics', 'English Language', 'Science', 'Social Studies', 'French',
  'Creative Arts', 'Physical Education', 'Music', 'Home Economics',
  'Computer Studies / ICT', 'Civic Education', 'Agricultural Science',
  'Christian Religious Studies', 'Islamic Religious Studies', 'Moral Education',
  'Health Education', 'Vocational Studies', 'History', 'Geography',
  'Basic Technology', 'Handwriting', 'Phonics', 'Numeracy',
  'Literacy', 'Life Skills', 'Environmental Studies'
];

export const EXAM_TYPES = [
  { id: 'first_school', name: 'First School Leaving Certificate' },
  { id: 'common_entrance', name: 'Common Entrance Examination' },
  { id: 'national_primary', name: 'National Primary Assessment' },
  { id: 'kcpe', name: 'KCPE (Kenya)' },
  { id: 'bece', name: 'BECE (Ghana)' },
  { id: 'ple', name: 'PLE (Uganda)' },
  { id: 'psle', name: 'PSLE (Tanzania)' },
  { id: 'custom', name: 'Custom Exam' },
];

export const PRICING_PLANS = [
  {
    id: 'free',
    name: 'Starter',
    price: 0,
    currency: 'USD',
    period: 'month',
    features: [
      '3 Lesson Notes per month',
      'Basic content library',
      '1 Country curriculum',
      'PDF Export (watermarked)',
      'Community support',
    ],
    limitations: ['No AI Knowledge Base', 'No Website Builder', 'No Exam Bank'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 9.99,
    currency: 'USD',
    period: 'month',
    features: [
      'Unlimited Lesson Notes',
      'Full content library',
      'All country curricula',
      'PDF Export (clean)',
      'AI Knowledge Base',
      'Exam Bank access',
      'Priority support',
      'Multi-language support',
    ],
    limitations: ['No Website Builder'],
    popular: true,
  },
  {
    id: 'school',
    name: 'School',
    price: 29.99,
    currency: 'USD',
    period: 'month',
    features: [
      'Everything in Professional',
      'AI Website Builder',
      'Custom school domain',
      'Up to 20 teacher accounts',
      'School branding on exports',
      'Bulk lesson generation',
      'Analytics dashboard',
      'Dedicated support',
    ],
    limitations: [],
  },
];

export const HERO_IMAGE = 'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423145351_838fe789.png';
export const AFRICA_MAP_IMAGE = 'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423204969_a8300c45.png';

export const STUDENT_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423158120_67870076.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423158884_064b027b.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423161006_7f88b9aa.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423162112_12ee4443.jpg',
];

export const GAME_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423180953_b2e1607f.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423181026_b802bbb1.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423186321_f1c78f0c.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423182669_00dad3aa.jpg',
];

export const TEACHER_IMAGES = [
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423224016_083e203d.png',
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423218376_8460654c.jpg',
  'https://d64gsuwffb70l.cloudfront.net/698682f8b65dbd4a3fecd6d7_1770423219846_e051c745.jpg',
];
