import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gbodomwqtegpyhbutnuc.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gCuEX1wB8rDIFE6LUqARDA_elaCUkXj';

export const supabase = createClient(supabaseUrl, supabaseKey);
