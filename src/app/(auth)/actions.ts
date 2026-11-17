"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safePath } from "@/lib/safe-path";

export type AuthState = { error?: string; message?: string };

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Preencha e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirme seu e-mail pelo link que enviamos antes de entrar." };
    }
    return { error: "E-mail ou senha incorretos. Confira os dados e tente de novo." };
  }

  redirect(safePath(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email) return { error: "Preencha nome e e-mail." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=/painel`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") return { error: "Já existe uma conta com esse e-mail. Tente entrar." };
    return { error: "Não foi possível criar a conta agora. Tente novamente em instantes." };
  }

  // Com confirmação de e-mail desligada, o Supabase já devolve a sessão.
  if (data.session) redirect("/painel");

  return { message: `Enviamos um link de confirmação para ${email}. Abra o e-mail para ativar sua conta.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
