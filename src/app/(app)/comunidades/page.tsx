import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LANGUAGES, languageLabel } from "@/lib/config";
import { Badge, EmptyState, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/form-controls";
import { createCommunity, joinCommunity } from "./actions";

export const metadata = { title: "Comunidades" };

export default async function CommunitiesPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data } = await supabase
    .from("communities")
    .select("id, slug, name, language, description, community_members(user_id)")
    .order("created_at", { ascending: true });

  const communities = (data ?? []).map((c) => {
    const members = (c.community_members ?? []) as { user_id: string }[];
    return { ...c, memberCount: members.length, joined: members.some((m) => m.user_id === viewer.id) };
  });

  return (
    <>
      <PageHeader
        title="Comunidades"
        description="Grupos por idioma para praticar com outros alunos: publique dúvidas, compartilhe conquistas e converse no chat."
      />
      <div className={viewer.isTeacher ? "grid gap-8 lg:grid-cols-[1fr_340px]" : ""}>
        <div>
          {communities.length === 0 ? (
            <EmptyState
              title="Nenhuma comunidade ainda"
              description={viewer.isTeacher ? "Crie a primeira, por exemplo “Inglês” ou “Espanhol”." : "Em breve os professores abrem as comunidades."}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {communities.map((c) => (
                <li key={c.id} className="card flex flex-col p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge tone="accent">{languageLabel(c.language)}</Badge>
                    <span className="text-xs text-muted">
                      {c.memberCount} membro{c.memberCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <Link href={`/comunidades/${c.slug}`} className="font-display text-lg font-semibold hover:underline">
                    {c.name}
                  </Link>
                  {c.description ? <p className="mt-1.5 line-clamp-3 text-sm text-muted">{c.description}</p> : null}
                  <div className="mt-auto flex gap-2 pt-5">
                    <Link href={`/comunidades/${c.slug}`} className="btn btn-secondary btn-sm">
                      Abrir
                    </Link>
                    {c.joined ? (
                      <span className="inline-flex h-8 items-center text-[13px] text-accent">Você participa</span>
                    ) : (
                      <form action={joinCommunity}>
                        <input type="hidden" name="community_id" value={c.id} />
                        <input type="hidden" name="slug" value={c.slug} />
                        <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Entrando…">
                          Participar
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {viewer.isTeacher ? (
          <aside>
            <div className="card p-5 lg:sticky lg:top-8">
              <h2 className="mb-4 font-semibold">Nova comunidade</h2>
              <form action={createCommunity} className="space-y-4">
                <Field label="Nome" htmlFor="community-name">
                  <input id="community-name" name="name" required maxLength={80} className="input" placeholder="Ex.: Inglês · Conversação" />
                </Field>
                <Field label="Idioma" htmlFor="community-language">
                  <select id="community-language" name="language" className="input" defaultValue="en">
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Descrição" htmlFor="community-description">
                  <textarea
                    id="community-description"
                    name="description"
                    rows={3}
                    className="input"
                    placeholder="Regras, objetivo, desafio da semana…"
                  />
                </Field>
                <SubmitButton className="btn btn-primary w-full" pendingLabel="Criando…">
                  Criar comunidade
                </SubmitButton>
              </form>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
