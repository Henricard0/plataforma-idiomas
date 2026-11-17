import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRoster, getTeachersOf, one } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { Avatar, Badge, EmptyState, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/form-controls";
import { createGroupConversation, startDirectConversation } from "./actions";

export const metadata = { title: "Mensagens" };

type MemberRow = {
  last_read_at: string;
  conversation: {
    id: string;
    kind: "direct" | "group";
    title: string | null;
    last_message_at: string | null;
    created_at: string;
    conversation_members: { user_id: string; profile: { full_name: string } | null }[];
  } | null;
};

export default async function MessagesPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data } = await supabase
    .from("conversation_members")
    .select(
      "last_read_at, conversation:conversations!inner(id, kind, title, last_message_at, created_at, conversation_members(user_id, profile:profiles!user_id(full_name)))",
    )
    .eq("user_id", viewer.id)
    .in("conversation.kind", ["direct", "group"]);

  const conversations = ((data ?? []) as unknown as MemberRow[])
    .map((row) => {
      const c = one(row.conversation);
      if (!c) return null;
      const others = c.conversation_members.filter((m) => m.user_id !== viewer.id);
      const name =
        c.kind === "group" ? (c.title ?? "Grupo") : (one(others[0]?.profile)?.full_name ?? "Conversa");
      const lastAt = c.last_message_at ?? c.created_at;
      return {
        id: c.id,
        kind: c.kind,
        name,
        members: c.conversation_members.length,
        lastAt,
        unread: Boolean(c.last_message_at && c.last_message_at > row.last_read_at),
      };
    })
    .filter((c) => c !== null)
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const contacts = viewer.isTeacher ? await getRoster(supabase, viewer.id) : await getTeachersOf(supabase, viewer.id);

  return (
    <>
      <PageHeader
        title="Mensagens"
        description="Converse com seu professor, tire dúvidas entre as aulas e pratique em grupo."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {conversations.length === 0 ? (
            <EmptyState
              title="Nenhuma conversa ainda"
              description={
                viewer.isTeacher
                  ? "Comece uma conversa com um aluno ou crie um grupo de conversação."
                  : "Mande uma mensagem para o seu professor pelo painel ao lado."
              }
            />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link href={`/mensagens/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper">
                    <Avatar name={c.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${c.unread ? "font-semibold" : "font-medium"}`}>{c.name}</p>
                      <p className="text-xs text-muted">
                        {c.kind === "group" ? `Grupo · ${c.members} pessoas · ` : ""}
                        {formatDateTime(c.lastAt)}
                      </p>
                    </div>
                    {c.unread ? <Badge tone="accent">Nova</Badge> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">{viewer.isTeacher ? "Conversar com um aluno" : "Seus professores"}</h2>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted">
                {viewer.isTeacher
                  ? "Adicione alunos em “Meus alunos” para conversar com eles."
                  : "Assim que um professor adicionar você, ele aparece aqui."}
              </p>
            ) : (
              <ul className="space-y-1">
                {contacts.map((p) => (
                  <li key={p.id}>
                    <form action={startDirectConversation}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <SubmitButton
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper"
                        pendingLabel="Abrindo…"
                      >
                        <Avatar name={p.full_name} size={28} />
                        <span className="truncate">{p.full_name}</span>
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {viewer.isTeacher && contacts.length > 0 ? (
            <div className="card p-5">
              <h2 className="mb-1 text-sm font-semibold">Novo grupo de conversação</h2>
              <p className="mb-4 text-sm text-muted">Para turmas praticarem juntas entre as aulas.</p>
              <form action={createGroupConversation} className="space-y-4">
                <Field label="Nome do grupo" htmlFor="group-title">
                  <input id="group-title" name="title" required maxLength={80} className="input" placeholder="Ex.: Turma B1 · terças" />
                </Field>
                <fieldset>
                  <legend className="label">Alunos</legend>
                  <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-line p-2">
                    {contacts.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="member_ids" value={p.id} className="accent-accent" />
                        {p.full_name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SubmitButton className="btn btn-primary w-full" pendingLabel="Criando…">
                  Criar grupo
                </SubmitButton>
              </form>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
