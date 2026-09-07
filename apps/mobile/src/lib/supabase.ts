import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Production is the default. Both values are client-side by design: the
 * publishable key identifies the project and row-level security guards the
 * data, so they sit in the binary either way. Env overrides them for a
 * staging project (EAS environments or apps/mobile/.env for Metro).
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gixfcrtnyjzlpylcimrb.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_FHBR5Ro-szpYciar1NuuKA_Qj88GLbL';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
