import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadChat } from "@/lib/chat";
import { one } from "@/lib/queries";
import { languageLabel } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/form-controls";
import { ArrowLeftIcon } from "@/components/icons";
import { ChatPanel } from "@/components/chat/chat-panel";
import { createComment, createPost, deletePost, joinCommunity, leaveCommunity } from "../actions";

type PostRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: { full_name: string } | null;
  post_comments: { id: string; body: string; created_at: string; author: { full_name: string } | null }[];
};

export default async function CommunityPage({ params }: PageProps<"/comunidades/[slug]">) {
  const { slug } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: community } = await supabase
    .from("communities")
    .select("id, slug, name, language, description, community_members(user_id, role)")
    .eq("slug", slug)
    .maybeSingle();
  if (!community) notFound();

  const members = (community.community_members ?? []) as { user_id: string; role: string }[];
  const me = members.find((m) => m.user_id === viewer.id);
  const isMember = Boolean(me);
  const isModerator = me?.role === "moderator";

  const { data: postRows } = await supabase
    .from("posts")
    .select(
      "id, body, created_at, author_id, author:profiles!author_id(full_name), post_comments(id, body, created_at, author:profiles!author_id(full_name))",
    )
    .eq("community_id", community.id)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "post_comments", ascending: true })
    .limit(30);
  const posts = (postRows ?? []) as unknown as PostRow[];

  const { data: conversation } = isMember
    ? await supabase.from("conversations").select("id").eq("community_id", community.id).maybeSingle()
    : { data: null };
  const chat = conversation ? await loadChat(supabase, conversation.id, 80) : null;

  return (
    <>
      <Link href="/comunidades" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon size={15} /> Comunidades
      </Link>
      <PageHeader
        title={community.name}
        eyebrow={
          <span className="flex items-center gap-2">
            <Badge tone="accent">{languageLabel(community.language)}</Badge>
            <span>
              {members.length} membro{members.length === 1 ? "" : "s"}
            </span>
          </span>
        }
        description={community.description ?? undefined}
        actions={
          isMember ? (
            isModerator ? null : (
              <form action={leaveCommunity}>
                <input type="hidden" name="community_id" value={community.id} />
                <input type="hidden" name="slug" value={community.slug} />
                <ConfirmSubmit message="Sair desta comunidade?" className="btn btn-secondary">
                  Sair da comunidade
                </ConfirmSubmit>
              </form>
            )
          ) : (
            <form action={joinCommunity}>
              <input type="hidden" name="community_id" value={community.id} />
              <input type="hidden" name="slug" value={community.slug} />
              <SubmitButton className="btn btn-primary" pendingLabel="Entrando…">
                Participar da comunidade
              </SubmitButton>
            </form>
          )
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          {isMember ? (
            <form action={createPost} className="card p-4">
              <input type="hidden" name="community_id" value={community.id} />
              <input type="hidden" name="slug" value={community.slug} />
              <label htmlFor="post-body" className="sr-only">
                Nova publicação
              </label>
              <textarea
                id="post-body"
                name="body"
                rows={3}
                required
                maxLength={5000}
                className="input"
                placeholder={`Escreva em ${languageLabel(community.language).toLowerCase()} ou tire uma dúvida…`}
              />
              <div className="mt-3 flex justify-end">
                <SubmitButton pendingLabel="Publicando…">Publicar</SubmitButton>
              </div>
            </form>
          ) : null}

          {posts.length === 0 ? (
            <EmptyState title="Nenhuma publicação ainda" description="Seja o primeiro a puxar assunto." />
          ) : (
            posts.map((post) => {
              const author = one(post.author);
              return (
                <article key={post.id} className="card p-5">
                  <header className="mb-3 flex items-center gap-3">
                    <Avatar name={author?.full_name} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{author?.full_name}</p>
                      <p className="text-xs text-muted">{formatDateTime(post.created_at)}</p>
                    </div>
                    {post.author_id === viewer.id || isModerator ? (
                      <form action={deletePost}>
                        <input type="hidden" name="post_id" value={post.id} />
                        <input type="hidden" name="slug" value={community.slug} />
                        <ConfirmSubmit message="Apagar esta publicação?" className="btn btn-ghost btn-sm text-muted">
                          Apagar
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                  </header>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{post.body}</p>

                  {post.post_comments.length > 0 || isMember ? (
                    <div className="mt-4 space-y-3 border-t border-line pt-4">
                      {post.post_comments.map((c) => {
                        const commentAuthor = one(c.author);
                        return (
                          <div key={c.id} className="flex gap-2.5">
                            <Avatar name={commentAuthor?.full_name} size={26} />
                            <div className="min-w-0 rounded-lg bg-paper px-3 py-2">
                              <p className="text-xs">
                                <span className="font-medium">{commentAuthor?.full_name}</span>{" "}
                                <span className="text-muted">· {formatDateTime(c.created_at)}</span>
                              </p>
                              <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
                            </div>
                          </div>
                        );
                      })}
                      {isMember ? (
                        <form action={createComment} className="flex gap-2">
                          <input type="hidden" name="post_id" value={post.id} />
                          <input type="hidden" name="slug" value={community.slug} />
                          <label htmlFor={`comment-${post.id}`} className="sr-only">
                            Comentar
                          </label>
                          <input
                            id={`comment-${post.id}`}
                            name="body"
                            required
                            maxLength={2000}
                            className="input h-9"
                            placeholder="Comentar…"
                          />
                          <SubmitButton className="btn btn-secondary btn-sm h-9" pendingLabel="…">
                            Enviar
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        <aside>
          <h2 className="mb-2 text-sm font-semibold">Chat da comunidade</h2>
          {conversation && chat ? (
            <ChatPanel
              conversationId={conversation.id}
              viewerId={viewer.id}
              initialMessages={chat.messages}
              people={chat.people}
              placeholder="Pratique aqui…"
              className="h-[65vh] min-h-[400px] lg:sticky lg:top-8"
            />
          ) : (
            <div className="card p-5 text-sm text-muted">Participe da comunidade para entrar no chat e praticar com os outros alunos.</div>
          )}
        </aside>
      </div>
    </>
  );
}
