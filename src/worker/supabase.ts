import { createClient } from '@supabase/supabase-js';

export const createSupabaseClient = (env: { SUPABASE_URL: string; SUPABASE_KEY: string; SUPABASE_SERVICE_ROLE_KEY?: string }) => {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
  return createClient(env.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
};
