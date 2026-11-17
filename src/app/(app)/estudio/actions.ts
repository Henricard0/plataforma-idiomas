"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parsePriceToCents, slugify } from "@/lib/format";

function courseFields(formData: FormData) {
  const billing = formData.get("billing") === "one_time" ? "one_time" : "monthly";
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    language: String(formData.get("language") ?? "en"),
    level: String(formData.get("level") ?? "") || null,
    price_cents: parsePriceToCents(String(formData.get("price") ?? "0")),
    billing,
  };
}

export async function createCourse(formData: FormData) {
  const viewer = await requireTeacher();
  const fields = courseFields(formData);
  if (!fields.title) throw new Error("Dê um título ao curso.");

  const supabase = await createClient();
  const base = slugify(fields.title) || "curso";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data } = await supabase.from("courses").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }

  const { data: course, error } = await supabase
    .from("courses")
    .insert({ ...fields, slug, teacher_id: viewer.id, published: false })
    .select("id")
    .single();
  if (error || !course) throw new Error("Não foi possível criar o curso.");

  revalidatePath("/estudio");
  redirect(`/estudio/${course.id}`);
}

export async function updateCourse(formData: FormData) {
  await requireTeacher();
  const id = String(formData.get("course_id") ?? "");
  const fields = courseFields(formData);
  if (!fields.title) throw new Error("Dê um título ao curso.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ ...fields, published: formData.get("published") === "on" })
    .eq("id", id);
  if (error) throw new Error("Não foi possível salvar o curso.");

  revalidatePath(`/estudio/${id}`);
  revalidatePath("/cursos");
}

export async function deleteCourse(formData: FormData) {
  const viewer = await requireTeacher();
  const id = String(formData.get("course_id") ?? "");
  const supabase = await createClient();

  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", id)
    .eq("provider", "stripe")
    .eq("status", "active");
  if (count && count > 0) {
    throw new Error("Este curso tem alunos pagantes ativos. Despublique em vez de excluir.");
  }

  const { data: files } = await supabase.storage.from("course-videos").list(`${viewer.id}/${id}`, { limit: 1000 });
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir o curso.");
  if (files?.length) {
    await supabase.storage.from("course-videos").remove(files.map((f) => `${viewer.id}/${id}/${f.name}`));
  }

  revalidatePath("/estudio");
  revalidatePath("/cursos");
  redirect("/estudio");
}

export type NewEpisode = {
  courseId: string;
  title: string;
  description?: string;
  releaseAt: string;
  isFreePreview: boolean;
  videoPath: string;
  durationSec: number | null;
};

export async function createEpisode(input: NewEpisode): Promise<{ error?: string }> {
  const viewer = await requireTeacher();
  if (!input.title.trim()) return { error: "Dê um título ao episódio." };
  if (!input.videoPath.startsWith(`${viewer.id}/${input.courseId}/`)) return { error: "Vídeo inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("episodes").insert({
    course_id: input.courseId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    release_at: input.releaseAt || new Date().toISOString(),
    is_free_preview: input.isFreePreview,
    video_path: input.videoPath,
    duration_sec: input.durationSec,
  });
  if (error) return { error: "Não foi possível salvar o episódio." };

  revalidatePath(`/estudio/${input.courseId}`);
  revalidatePath("/cursos");
  return {};
}

export async function deleteEpisode(formData: FormData) {
  await requireTeacher();
  const id = String(formData.get("episode_id") ?? "");
  const supabase = await createClient();

  const { data: episode } = await supabase
    .from("episodes")
    .select("course_id, video_path")
    .eq("id", id)
    .maybeSingle();
  if (!episode) return;

  await supabase.from("episodes").delete().eq("id", id);
  if (episode.video_path) await supabase.storage.from("course-videos").remove([episode.video_path]);
  revalidatePath(`/estudio/${episode.course_id}`);
}

export type AccessState = { error?: string; message?: string };

/** Libera o curso para um aluno sem pagamento (ex.: bônus para quem já faz aula particular). */
export async function grantAccess(_prev: AccessState, formData: FormData): Promise<AccessState> {
  await requireTeacher();
  const courseId = String(formData.get("course_id") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Informe o e-mail do aluno." };

  const supabase = await createClient();
  const { data: found } = await supabase.rpc("find_profile_by_email", { p_email: email });
  const person = Array.isArray(found) ? found[0] : null;
  if (!person) return { error: "Não encontramos uma conta com esse e-mail. Peça para o aluno se cadastrar primeiro." };

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id, provider, status")
    .eq("course_id", courseId)
    .eq("user_id", person.id)
    .maybeSingle();

  if (existing?.provider === "stripe") {
    return existing.status === "active"
      ? { message: `${person.full_name} já tem acesso pago a este curso.` }
      : { error: `${person.full_name} tem uma compra pelo Stripe neste curso. Resolva o pagamento pelo painel do Stripe.` };
  }

  const { error } = existing
    ? await supabase.from("enrollments").update({ status: "active" }).eq("id", existing.id)
    : await supabase
        .from("enrollments")
        .insert({ course_id: courseId, user_id: person.id, status: "active", provider: "manual" });
  if (error) return { error: "Não foi possível liberar o acesso." };

  revalidatePath(`/estudio/${courseId}`);
  return { message: `Acesso liberado para ${person.full_name}.` };
}

export async function revokeAccess(formData: FormData) {
  await requireTeacher();
  const id = String(formData.get("enrollment_id") ?? "");
  const courseId = String(formData.get("course_id") ?? "");
  const supabase = await createClient();
  await supabase.from("enrollments").delete().eq("id", id).eq("provider", "manual");
  revalidatePath(`/estudio/${courseId}`);
}
