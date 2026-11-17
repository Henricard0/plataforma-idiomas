"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createClass(formData: FormData) {
  const viewer = await requireTeacher();
  const title = String(formData.get("title") ?? "").trim();
  const language = String(formData.get("language") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "");
  const duration = Number(formData.get("duration_min") ?? 60);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const studentIds = formData.getAll("student_ids").map(String).filter(Boolean);

  if (!title || !language || !startsAt) throw new Error("Preencha título, idioma e data da aula.");

  const supabase = await createClient();
  const { data: cls, error } = await supabase
    .from("classes")
    .insert({ teacher_id: viewer.id, title, language, starts_at: startsAt, duration_min: duration, notes })
    .select("id")
    .single();
  if (error || !cls) throw new Error("Não foi possível agendar a aula.");

  if (studentIds.length > 0) {
    const { error: membersError } = await supabase
      .from("class_students")
      .insert(studentIds.map((student_id) => ({ class_id: cls.id, student_id })));
    if (membersError) throw new Error("A aula foi criada, mas não conseguimos adicionar os alunos.");
  }

  revalidatePath("/aulas");
  redirect(`/aulas/${cls.id}`);
}

export async function deleteClass(formData: FormData) {
  await requireTeacher();
  const id = String(formData.get("class_id") ?? "");
  const supabase = await createClient();
  // Os registros de materiais caem em cascata; os arquivos precisam sair do storage.
  const { data: files } = await supabase.from("materials").select("file_path").eq("class_id", id);
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw new Error("Não foi possível cancelar a aula.");
  if (files?.length) await supabase.storage.from("materials").remove(files.map((f) => f.file_path));
  revalidatePath("/aulas");
  redirect("/aulas");
}

export async function updateClassStudents(formData: FormData) {
  await requireTeacher();
  const classId = String(formData.get("class_id") ?? "");
  const selected = new Set(formData.getAll("student_ids").map(String));
  const supabase = await createClient();

  const { data: current } = await supabase.from("class_students").select("student_id").eq("class_id", classId);
  const currentIds = new Set((current ?? []).map((r) => r.student_id as string));

  const toAdd = [...selected].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !selected.has(id));

  if (toAdd.length) {
    await supabase.from("class_students").insert(toAdd.map((student_id) => ({ class_id: classId, student_id })));
  }
  if (toRemove.length) {
    await supabase.from("class_students").delete().eq("class_id", classId).in("student_id", toRemove);
  }
  revalidatePath(`/aulas/${classId}`);
}
