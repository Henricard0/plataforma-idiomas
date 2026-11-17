"use server";

import { redirect } from "next/navigation";
import { requireTeacher, requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Abre (ou reaproveita) a conversa direta com outra pessoa. */
export async function startDirectConversation(formData: FormData) {
  await requireViewer();
  const otherId = String(formData.get("user_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", { p_other: otherId });
  if (error || !data) throw new Error("Não foi possível abrir a conversa.");
  redirect(`/mensagens/${data}`);
}

/** Grupo de conversação criado pelo professor com alunos dele. */
export async function createGroupConversation(formData: FormData) {
  await requireTeacher();
  const title = String(formData.get("title") ?? "").trim();
  const members = formData.getAll("member_ids").map(String).filter(Boolean);
  if (!title) throw new Error("Dê um nome ao grupo.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_conversation", { p_title: title, p_members: members });
  if (error || !data) throw new Error("Não foi possível criar o grupo.");
  redirect(`/mensagens/${data}`);
}
