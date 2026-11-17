"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeftIcon, CloseIcon, ExpandIcon, ShrinkIcon, VideoIcon } from "@/components/icons";

// O LiveKit só roda no navegador.
const LiveKitStage = dynamic(() => import("./livekit-stage"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-white/70">Conectando…</div>,
});

type Connection = { token: string; serverUrl: string; canPublish: boolean };

/** Traduz os erros mais comuns do LiveKit para algo que o professor consiga resolver. */
function describeConnectionError(error: Error) {
  const text = `${error.name} ${error.message}`.toLowerCase();
  if (text.includes("notallowed") || text.includes("permission")) {
    return "O navegador bloqueou a câmera ou o microfone. Clique no cadeado ao lado do endereço do site e permita.";
  }
  if (
    text.includes("401") ||
    text.includes("unauthorized") ||
    text.includes("invalid api key") ||
    text.includes("invalid token") ||
    text.includes("signature") ||
    text.includes("not authorized")
  ) {
    return "O LiveKit recusou as chaves. Confira se LIVEKIT_API_KEY e LIVEKIT_API_SECRET foram copiadas do mesmo projeto do endereço em NEXT_PUBLIC_LIVEKIT_URL.";
  }
  if (
    text.includes("signal") ||
    text.includes("websocket") ||
    text.includes("failed to fetch") ||
    text.includes("network") ||
    text.includes("timeout")
  ) {
    return "Não foi possível falar com o servidor de vídeo. Confira se NEXT_PUBLIC_LIVEKIT_URL está certo (começa com wss:// e termina com .livekit.cloud).";
  }
  return "Não foi possível entrar na sala.";
}

const noopSubscribe = () => () => {};

function subscribeFullscreen(callback: () => void) {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}

/**
 * Sala de vídeo em página própria (/sala/...), aberta numa janela separada.
 * Ocupa a janela inteira; `sidebar` (ex.: chat da live) fica ao lado do vídeo.
 */
export function VideoRoom({
  kind,
  id,
  title,
  joinLabel = "Entrar na sala",
  description,
  sidebar,
  sidebarTitle,
  backHref,
}: {
  kind: "class" | "live";
  id: string;
  title: string;
  joinLabel?: string;
  description?: string;
  sidebar?: ReactNode;
  sidebarTitle?: string;
  /** Para onde voltar quando a sala foi aberta na mesma aba (sem janela separada). */
  backHref: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(false);

  const canFullscreen = useSyncExternalStore(noopSubscribe, () => Boolean(document.fullscreenEnabled), () => false);
  const isFullscreen = useSyncExternalStore(subscribeFullscreen, () => Boolean(document.fullscreenElement), () => false);
  // Janela aberta pela plataforma (pop-up) → botão "Fechar janela"; senão, link para voltar.
  const isPopup = useSyncExternalStore(noopSubscribe, () => Boolean(window.opener), () => false);

  const inCall = connection !== null;

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);

  // Callbacks estáveis (useCallback): se mudarem a cada render, o LiveKit reconecta e a chamada cai.
  const handleLeave = useCallback(
    (message?: string, reason?: string) => {
      exitFullscreen();
      setConnection(null);
      setWarning(null);
      if (message) {
        setError((prev) => prev ?? message);
        setDetail((prev) => prev ?? (reason ? `motivo: ${reason}` : null));
      } else {
        setLeft(true);
      }
    },
    [exitFullscreen],
  );

  const handleError = useCallback(
    (e: Error) => {
      exitFullscreen();
      setError(describeConnectionError(e));
      setDetail(e.message);
      setConnection(null);
    },
    [exitFullscreen],
  );

  function toggleFullscreen() {
    if (document.fullscreenElement) exitFullscreen();
    else void rootRef.current?.requestFullscreen().catch(() => undefined);
  }

  async function join() {
    setLoading(true);
    setError(null);
    setDetail(null);
    setWarning(null);
    setLeft(false);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível entrar na sala.");
      setConnection(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar na sala.");
    } finally {
      setLoading(false);
    }
  }

  const headerButton = "inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] text-white/80 hover:bg-white/10 hover:text-white";

  return (
    <div ref={rootRef} className="flex h-dvh flex-col bg-[#0b0b0b] text-white">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        {isPopup ? null : (
          <Link href={backHref} className={headerButton} aria-label="Voltar para a plataforma">
            <ArrowLeftIcon size={16} />
          </Link>
        )}
        {kind === "live" && inCall ? (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-live px-2.5 text-xs font-medium">
            <span className="size-1.5 animate-pulse rounded-full bg-white" /> Ao vivo
          </span>
        ) : (
          <VideoIcon size={18} className="ml-1 text-white/60" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
        {canFullscreen ? (
          <button type="button" onClick={toggleFullscreen} className={headerButton}>
            {isFullscreen ? <ShrinkIcon size={16} /> : <ExpandIcon size={16} />}
            <span className="hidden sm:inline">{isFullscreen ? "Sair da tela cheia" : "Tela cheia"}</span>
          </button>
        ) : null}
        {isPopup ? (
          <button
            type="button"
            onClick={() => window.close()}
            className={headerButton}
            aria-label="Fechar janela"
            title={inCall ? "Fechar a janela encerra a sua participação na chamada" : "Fechar janela"}
          >
            <CloseIcon size={16} />
            <span className="hidden sm:inline">Fechar</span>
          </button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="relative min-h-0 flex-1">
          {connection ? (
            <>
              {warning ? (
                <div
                  className="absolute inset-x-0 top-0 z-10 flex items-start gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900"
                  role="alert"
                >
                  <p className="flex-1 text-center">{warning}</p>
                  <button type="button" className="shrink-0 font-medium underline" onClick={() => setWarning(null)}>
                    Fechar
                  </button>
                </div>
              ) : null}
              <div className="absolute inset-0">
                <LiveKitStage
                  token={connection.token}
                  serverUrl={connection.serverUrl}
                  publish={connection.canPublish}
                  mode={kind === "live" ? "broadcast" : "conference"}
                  onLeave={handleLeave}
                  onError={handleError}
                  onDeviceWarning={setWarning}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-white/10">
                <VideoIcon size={24} />
              </span>
              <p className="max-w-sm text-sm text-white/70">
                {left ? "Você saiu da chamada. Pode entrar de novo ou fechar esta janela." : description}
              </p>
              <button type="button" className="btn btn-primary h-11 px-6" onClick={join} disabled={loading}>
                {loading ? "Entrando…" : left ? "Entrar de novo" : joinLabel}
              </button>
              {error ? (
                <div className="max-w-md" role="alert">
                  <p className="text-sm text-red-300">{error}</p>
                  {detail ? <p className="mt-1 font-mono text-xs break-words text-white/40">{detail}</p> : null}
                </div>
              ) : null}
            </div>
          )}
        </main>

        {sidebar ? (
          <aside className="flex h-[38vh] shrink-0 flex-col border-t border-white/10 bg-surface text-ink lg:h-auto lg:w-[360px] lg:border-t-0 lg:border-l">
            {sidebarTitle ? <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold">{sidebarTitle}</h2> : null}
            <div className="min-h-0 flex-1 *:h-full! *:min-h-0! *:rounded-none! *:border-0!">{sidebar}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
