import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage } from "@/components/chat/chat-panel";

/** Últimas mensagens de uma conversa + nomes de quem enviou, para o render inicial do chat. */
export async function loadChat(supabase: SupabaseClient, conversationId: string, limit = 60) {
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, sender:profiles!sender_id(full_name)")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(limit);

  const rows = (data ?? []).reverse();
  const people: Record<string, string> = {};
  const messages: ChatMessage[] = rows.map((row) => {
    const sender = row.sender as unknown as { full_name: string } | null;
    if (sender) people[row.sender_id] = sender.full_name;
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      body: row.body,
      created_at: row.created_at,
    };
  });
  return { messages, people };
}
