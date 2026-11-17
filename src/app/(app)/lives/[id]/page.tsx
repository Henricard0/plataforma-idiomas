import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadChat } from "@/lib/chat";
import { one } from "@/lib/queries";
import { languageLabel } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { Badge, PageHeader } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/form-controls";
import { ArrowLeftIcon, LockIcon, RadioIcon } from "@/components/icons";
import { ChatPanel } from "@/components/chat/chat-panel";
import { VideoRoom } from "@/components/video/video-room";
import { LiveStatusWatcher } from "../live-status-watcher";
import { deleteLive, setLiveStatus } from "../actions";

export default async function LivePage({ params }: PageProps<"/lives/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: live } = await supabase
    .from("lives")
    .select(
      "id, title, description, language, status, scheduled_at, host_id, course_id, host:profiles!host_id(full_name), course:courses(slug, title)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!live) notFound();

  const isHost = live.host_id === viewer.id;
  const host = one(live.host as unknown as { full_name: string } | null);
  const course = one(live.course as unknown as { slug: string; title: string } | null);
  const { data: canWatch } = await supabase.rpc("can_watch_live", { p_live: live.id });

  const { data: conversation } = canWatch
    ? await supabase.from("conversations").select("id").eq("live_id", live.id).maybeSingle()
    : { data: null };
  const chat = conversation ? await loadChat(supabase, conversation.id, 100) : null;

  return (
    <>
      <LiveStatusWatcher liveId={live.id} status={live.status} />
      <Link href="/lives" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon size={15} /> Lives
      </Link>
      <PageHeader
        title={live.title}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {live.status === "live" ? <Badge tone="live">Ao vivo</Badge> : null}
            {live.status === "scheduled" ? <Badge>Agendada</Badge> : null}
            {live.status === "ended" ? <Badge>Encerrada</Badge> : null}
            {live.language ? <Badge tone="accent">{languageLabel(live.language)}</Badge> : null}
            {course ? <Badge tone="warning">Exclusiva: {course.title}</Badge> : null}
          </span>
        }
        description={`${formatDateTime(live.scheduled_at)}${host ? ` · com ${host.full_name}` : ""}`}
        actions={
          isHost ? (
            <>
              {live.status === "scheduled" ? (
                <form action={setLiveStatus}>
                  <input type="hidden" name="live_id" value={live.id} />
                  <input type="hidden" name="status" value="live" />
                  <SubmitButton className="btn btn-live" pendingLabel="Iniciando…">
                    <RadioIcon size={16} /> Iniciar live
                  </SubmitButton>
                </form>
              ) : null}
              {live.status === "live" ? (
                <form action={setLiveStatus}>
                  <input type="hidden" name="live_id" value={live.id} />
                  <input type="hidden" name="status" value="ended" />
                  <ConfirmSubmit message="Encerrar a live para todos?" className="btn btn-secondary">
                    Encerrar live
                  </ConfirmSubmit>
                </form>
              ) : null}
              {live.status !== "live" ? (
                <form action={deleteLive}>
                  <input type="hidden" name="live_id" value={live.id} />
                  <ConfirmSubmit message="Excluir esta live e o chat dela?">Excluir</ConfirmSubmit>
                </form>
              ) : null}
            </>
          ) : null
        }
      />

      {!canWatch ? (
        <div className="card flex max-w-xl flex-col items-start gap-3 p-6">
          <LockIcon size={22} className="text-muted" />
          <p className="font-medium">Esta live é exclusiva para alunos do curso {course?.title}.</p>
          {course ? (
            <Link href={`/cursos/${course.slug}`} className="btn btn-primary">
              Conhecer o curso
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            {live.status === "ended" ? (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-[#111] px-6 text-center text-sm text-white/70">
                Esta live já terminou. Obrigado a todos que participaram!
              </div>
            ) : isHost ? (
              <VideoRoom
                kind="live"
                id={live.id}
                joinLabel="Abrir estúdio de transmissão"
                description={
                  live.status === "live"
                    ? "Você está ao vivo. Entre na sala para transmitir câmera e tela."
                    : "Entre para testar câmera e microfone. O público só consegue entrar depois que você clicar em “Iniciar live”."
                }
              />
            ) : live.status === "live" ? (
              <VideoRoom kind="live" id={live.id} joinLabel="Assistir à live" description="A live está acontecendo agora." />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-[#111] px-6 text-center text-white">
                <p className="font-medium">A live começa em {formatDateTime(live.scheduled_at)}</p>
                <p className="text-sm text-white/70">Deixe esta página aberta: ela atualiza sozinha quando começar.</p>
              </div>
            )}
            {live.description ? (
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed whitespace-pre-wrap text-ink/85">{live.description}</p>
            ) : null}
          </div>

          {conversation && chat ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Chat da live</h2>
              <ChatPanel
                conversationId={conversation.id}
                viewerId={viewer.id}
                initialMessages={chat.messages}
                people={chat.people}
                readOnly={live.status === "ended"}
                placeholder="Mande sua pergunta…"
                className="h-[60vh] min-h-[380px]"
              />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
