import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv, supabaseUrl } from "@/lib/env";

/**
 * Cliente com a chave secreta: ignora o RLS.
 * Use só em código de servidor que não depende do usuário logado (ex.: webhook do Stripe).
 */
export function createAdminClient() {
  return createClient(supabaseUrl, requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
