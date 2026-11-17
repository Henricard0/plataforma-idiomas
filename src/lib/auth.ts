import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "student" | "teacher" | "admin";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isTeacher: boolean;
};

/** Usuário logado + perfil. Memorizado por requisição. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  // Login validado localmente pela assinatura do token (sem ida ao servidor de autenticação).
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  const email = typeof claims.email === "string" ? claims.email : "";
  const role = (profile?.role ?? "student") as Role;
  return {
    id: claims.sub,
    email,
    fullName: profile?.full_name || email,
    role,
    isTeacher: role === "teacher" || role === "admin",
  };
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  return viewer;
}

export async function requireTeacher() {
  const viewer = await requireViewer();
  if (!viewer.isTeacher) redirect("/painel");
  return viewer;
}
