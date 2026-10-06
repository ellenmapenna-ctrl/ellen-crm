// Projeto Supabase próprio (migrado do Supabase gerenciado pelo Enter.pro em
// 14/08/2026, pra não depender mais de crédito/acesso do Enter.pro pra
// mudanças de schema — ver scripts/apply-schema.mjs e scripts/copiar-dados.mjs).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const SUPABASE_URL = "https://clysfczavikrfiesibsh.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SAk2Z7bzESRuLYxnzozKSQ__gonkdl5";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
