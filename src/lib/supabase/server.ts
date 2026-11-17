import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { assertSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/env";

/** Cliente do Supabase com a sessão do usuário (todas as consultas passam pelo RLS). */
export async function createClient() {
  // cookies()/connection() primeiro: no build e nos prefetches o Next adia a renderização
  // aqui, e nada abaixo roda. O cliente lê o relógio (validade do token), então a página
  // precisa ser renderizada por requisição.
  const cookieStore = await cookies();
  await connection();
  assertSupabaseConfigured();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
}
