import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadChat } from "@/lib/chat";
import { one } from "@/lib/queries";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata = { title: "Conversa" };

export default async function ConversationPage({ params }: PageProps<"/mensagens/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, kind, title, conversation_members(user_id, profile:profiles!user_id(full_name))")
    .eq("id", id)
    .in("kind", ["direct", "group"])
    .maybeSingle();
  if (!conversation) notFound();

  const members = (conversation.conversation_members ?? []).map((m) => ({
    id: m.user_id as string,
    name: one(m.profile as unknown as { full_name: string } | null)?.full_name ?? "",
  }));
  const others = members.filter((m) => m.id !== viewer.id);
  const title = conversation.kind === "group" ? (conversation.title ?? "Grupo") : (others[0]?.name ?? "Conversa");

  const { messages, people } = await loadChat(supabase, conversation.id);
  for (const m of members) people[m.id] = m.name;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/mensagens" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon size={15} /> Mensagens
      </Link>
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        {conversation.kind === "group" ? members.map((m) => m.name).join(", ") : "Conversa privada"}
      </p>
      <ChatPanel
        conversationId={conversation.id}
        viewerId={viewer.id}
        initialMessages={messages}
        people={people}
        trackRead
        className="h-[calc(100vh-15rem)] min-h-[420px]"
      />
    </div>
  );
}
