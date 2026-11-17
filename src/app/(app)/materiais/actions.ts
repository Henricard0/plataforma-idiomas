"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type NewMaterial = {
  title: string;
  description?: string;
  classId?: string | null;
  language?: string | null;
  filePath: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
};

export async function createMaterial(input: NewMaterial): Promise<{ error?: string }> {
  const viewer = await requireTeacher();
  if (!input.title.trim()) return { error: "Dê um título ao material." };
  if (!input.filePath.startsWith(`${viewer.id}/`)) return { error: "Arquivo inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("materials").insert({
    teacher_id: viewer.id,
    class_id: input.classId || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    language: input.language || null,
    file_path: input.filePath,
    file_name: input.fileName,
    mime_type: input.mimeType || null,
    size_bytes: input.sizeBytes ?? null,
  });
  if (error) return { error: "Não foi possível salvar o material." };

  revalidatePath("/materiais");
  if (input.classId) revalidatePath(`/aulas/${input.classId}`);
  return {};
}

export async function deleteMaterial(formData: FormData) {
  await requireTeacher();
  const id = String(formData.get("material_id") ?? "");
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("file_path, class_id")
    .eq("id", id)
    .maybeSingle();
  if (!material) return;

  await supabase.from("materials").delete().eq("id", id);
  await supabase.storage.from("materials").remove([material.file_path]);

  revalidatePath("/materiais");
  if (material.class_id) revalidatePath(`/aulas/${material.class_id}`);
}
