import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://qxrpjsnmvamjsiebndzj.databasepad.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjAyNWZmZjQxLTI4ZTEtNDBmYS05MjI2LTVkYzQ3MTFkZTc2NyJ9.eyJwcm9qZWN0SWQiOiJxeHJwanNubXZhbWpzaWVibmR6aiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwNDIzMDYwLCJleHAiOjIwODU3ODMwNjAsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.SHTcLlbFwXJVYQVs3lZAPr6et7XZP-bOq78wzR0ePis';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };