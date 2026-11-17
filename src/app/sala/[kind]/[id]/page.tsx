import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadChat } from "@/lib/chat";
import { ChatPanel } from "@/components/chat/chat-panel";
import { VideoRoom } from "@/components/video/video-room";

export const metadata = { title: "Sala de aula" };

/** Sala de vídeo em página própria, sem o menu da plataforma (aberta numa janela separada). */
export default function CallPage({ params }: PageProps<"/sala/[kind]/[id]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-[#0b0b0b]" />}>
      <CallContent params={params} />
    </Suspense>
  );
}

async function CallContent({ params }: { params: PageProps<"/sala/[kind]/[id]">["params"] }) {
  const { kind, id } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();

  if (kind === "aula") {
    // O RLS só devolve a aula para o professor e os alunos dela.
    const { data: cls } = await supabase.from("classes").select("id, title").eq("id", id).maybeSingle();
    if (!cls) notFound();
    return (
      <VideoRoom
        kind="class"
        id={cls.id}
        title={cls.title}
        joinLabel="Entrar na aula"
        description="O navegador vai pedir permissão para usar a câmera e o microfone."
        backHref={`/aulas/${cls.id}`}
      />
    );
  }

  if (kind !== "live") notFound();

  const { data: live } = await supabase
    .from("lives")
    .select("id, title, status, host_id, course:courses(slug, title)")
    .eq("id", id)
    .maybeSingle();
  if (!live) notFound();

  const isHost = live.host_id === viewer.id;
  const [{ data: canWatch }, { data: conversation }] = await Promise.all([
    supabase.rpc("can_watch_live", { p_live: live.id }),
    supabase.from("conversations").select("id").eq("live_id", live.id).maybeSingle(),
  ]);

  const blocked = !canWatch
    ? "Esta live é exclusiva para alunos do curso."
    : live.status === "ended"
      ? "Esta live já terminou."
      : !isHost && live.status !== "live"
        ? "A live ainda não começou. Volte para a página da live: ela avisa quando começar."
        : null;

  if (blocked) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#0b0b0b] px-6 text-center text-white">
        <p className="max-w-sm">{blocked}</p>
        <Link href={`/lives/${live.id}`} className="btn btn-secondary">
          Ir para a página da live
        </Link>
      </div>
    );
  }

  const chat = conversation ? await loadChat(supabase, conversation.id, 100) : null;

  return (
    <VideoRoom
      kind="live"
      id={live.id}
      title={live.title}
      joinLabel={isHost ? "Entrar no estúdio" : "Assistir"}
      description={
        isHost
          ? live.status === "live"
            ? "Você está ao vivo. Entre para transmitir câmera e tela."
            : "Teste câmera e microfone. O público só entra depois que você clicar em “Iniciar live” na página da live."
          : "A live está acontecendo agora."
      }
      backHref={`/lives/${live.id}`}
      sidebarTitle="Chat da live"
      sidebar={
        conversation && chat ? (
          <ChatPanel
            conversationId={conversation.id}
            viewerId={viewer.id}
            initialMessages={chat.messages}
            people={chat.people}
            placeholder="Mande sua pergunta…"
          />
        ) : null
      }
    />
  );
}
