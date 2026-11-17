"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createLive(formData: FormData) {
  const viewer = await requireTeacher();
  const title = String(formData.get("title") ?? "").trim();
  const scheduledAt = String(formData.get("scheduled_at") ?? "");
  if (!title || !scheduledAt) throw new Error("Preencha título e data da live.");

  const supabase = await createClient();
  const { data: live, error } = await supabase
    .from("lives")
    .insert({
      host_id: viewer.id,
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      language: String(formData.get("language") ?? "") || null,
      course_id: String(formData.get("course_id") ?? "") || null,
      scheduled_at: scheduledAt,
    })
    .select("id")
    .single();
  if (error || !live) throw new Error("Não foi possível agendar a live.");

  revalidatePath("/lives");
  redirect(`/lives/${live.id}`);
}

export async function setLiveStatus(formData: FormData) {
  await requireTeacher();
  const id = String(formData.get("live_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "live" && status !== "ended") return;

  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase
    .from("lives")
    .update(status === "live" ? { status, started_at: now } : { status, ended_at: now })
    .eq("id", id);

  revalidatePath(`/lives/${id}`);
  revalidatePath("/lives");
}

export async function deleteLive(formData: FormData) {
  await requireTeacher();
  const id = String(formData.get("live_id") ?? "");
  const supabase = await createClient();
  await supabase.from("lives").delete().eq("id", id);
  revalidatePath("/lives");
  redirect("/lives");
}
