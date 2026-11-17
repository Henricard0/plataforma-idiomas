"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RosterState = { error?: string; message?: string };

export async function addStudent(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const viewer = await requireTeacher();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Informe o e-mail do aluno." };

  const supabase = await createClient();
  const { data: found } = await supabase.rpc("find_profile_by_email", { p_email: email });
  const person = Array.isArray(found) ? found[0] : null;
  if (!person) {
    return { error: "Não encontramos uma conta com esse e-mail. Envie o link de cadastro para o aluno e tente de novo." };
  }
  if (person.id === viewer.id) return { error: "Esse é o seu próprio e-mail." };

  const { error } = await supabase.from("teacher_students").insert({ teacher_id: viewer.id, student_id: person.id });
  if (error?.code === "23505") return { message: `${person.full_name} já está na sua lista.` };
  if (error) return { error: "Não foi possível adicionar o aluno." };

  revalidatePath("/alunos");
  return { message: `${person.full_name} foi adicionado(a) aos seus alunos.` };
}

export async function removeStudent(formData: FormData) {
  const viewer = await requireTeacher();
  const studentId = String(formData.get("student_id") ?? "");
  const supabase = await createClient();
  await supabase.from("teacher_students").delete().eq("teacher_id", viewer.id).eq("student_id", studentId);
  revalidatePath("/alunos");
}
