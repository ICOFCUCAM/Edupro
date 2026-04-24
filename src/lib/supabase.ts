import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qxrpjsnmvamjsiebndzj.databasepad.com';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAyNWZmZjQxLTI4ZTEtNDBmYS05MjI2LTVkYzQ3MTFkZTc2NyJ9.eyJwcm9qZWN0SWQiOiJxeHJwanNubXZhbWpzaWVibmR6aiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwNDIzMDYwLCJleHAiOjIwODU3ODMwNjAsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.SHTcLlbFwXJVYQVs3lZAPr6et7XZP-bOq78wzR0ePis';

export const supabase = createClient(supabaseUrl, supabaseKey);
