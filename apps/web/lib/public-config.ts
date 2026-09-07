/**
 * Production Supabase, baked in. Both values are client-side by design and
 * row-level security is the guard. Env overrides them for a staging deploy.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gixfcrtnyjzlpylcimrb.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_FHBR5Ro-szpYciar1NuuKA_Qj88GLbL';
