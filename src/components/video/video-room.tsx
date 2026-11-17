"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { VideoIcon } from "@/components/icons";

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

export function VideoRoom({
  kind,
  id,
  joinLabel = "Entrar na sala",
  description,
}: {
  kind: "class" | "live";
  id: string;
  joinLabel?: string;
  description?: string;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join() {
    setLoading(true);
    setError(null);
    setDetail(null);
    setWarning(null);
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

  if (!connection) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-xl bg-[#111] px-6 text-center text-white">
        <span className="flex size-12 items-center justify-center rounded-full bg-white/10">
          <VideoIcon size={22} />
        </span>
        {description ? <p className="max-w-sm text-sm text-white/70">{description}</p> : null}
        <button type="button" className="btn btn-primary" onClick={join} disabled={loading}>
          {loading ? "Entrando…" : joinLabel}
        </button>
        {error ? (
          <div className="max-w-md" role="alert">
            <p className="text-sm text-red-300">{error}</p>
            {detail ? <p className="mt-1 font-mono text-xs break-words text-white/40">{detail}</p> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative h-[72vh] min-h-[420px] w-full overflow-hidden rounded-xl bg-[#111]">
      {warning ? (
        <p className="absolute inset-x-0 top-0 z-10 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900" role="alert">
          {warning}
        </p>
      ) : null}
      <LiveKitStage
        token={connection.token}
        serverUrl={connection.serverUrl}
        publish={connection.canPublish}
        mode={kind === "live" ? "broadcast" : "conference"}
        onLeave={() => setConnection(null)}
        onError={(e) => {
          setError(describeConnectionError(e));
          setDetail(e.message);
          setConnection(null);
        }}
        onDeviceWarning={setWarning}
      />
    </div>
  );
}
