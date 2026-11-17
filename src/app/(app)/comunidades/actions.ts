"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher, requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";

export async function createCommunity(formData: FormData) {
  const viewer = await requireTeacher();
  const name = String(formData.get("name") ?? "").trim();
  const language = String(formData.get("language") ?? "en");
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) throw new Error("Dê um nome à comunidade.");

  const supabase = await createClient();
  const base = slugify(name) || "comunidade";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data } = await supabase.from("communities").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }

  const { error } = await supabase
    .from("communities")
    .insert({ slug, name, language, description, created_by: viewer.id });
  if (error) throw new Error("Não foi possível criar a comunidade.");

  revalidatePath("/comunidades");
  redirect(`/comunidades/${slug}`);
}

export async function joinCommunity(formData: FormData) {
  const viewer = await requireViewer();
  const id = String(formData.get("community_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();
  await supabase.from("community_members").insert({ community_id: id, user_id: viewer.id });
  revalidatePath("/comunidades");
  if (slug) revalidatePath(`/comunidades/${slug}`);
}

export async function leaveCommunity(formData: FormData) {
  const viewer = await requireViewer();
  const id = String(formData.get("community_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();
  await supabase.from("community_members").delete().eq("community_id", id).eq("user_id", viewer.id);
  revalidatePath("/comunidades");
  if (slug) revalidatePath(`/comunidades/${slug}`);
}

export async function createPost(formData: FormData) {
  await requireViewer();
  const communityId = String(formData.get("community_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const supabase = await createClient();
  const { error } = await supabase.from("posts").insert({ community_id: communityId, body });
  if (error) throw new Error("Não foi possível publicar. Você precisa participar da comunidade.");
  revalidatePath(`/comunidades/${slug}`);
}

export async function createComment(formData: FormData) {
  await requireViewer();
  const postId = String(formData.get("post_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const supabase = await createClient();
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, body });
  if (error) throw new Error("Não foi possível comentar. Você precisa participar da comunidade.");
  revalidatePath(`/comunidades/${slug}`);
}

export async function deletePost(formData: FormData) {
  await requireViewer();
  const postId = String(formData.get("post_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();
  await supabase.from("posts").delete().eq("id", postId);
  revalidatePath(`/comunidades/${slug}`);
}
