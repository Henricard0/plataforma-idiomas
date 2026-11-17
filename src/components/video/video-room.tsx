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
  const [loading, setLoading] = useState(false);

  async function join() {
    setLoading(true);
    setError(null);
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
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-[72vh] min-h-[420px] w-full overflow-hidden rounded-xl bg-[#111]">
      <LiveKitStage
        token={connection.token}
        serverUrl={connection.serverUrl}
        publish={connection.canPublish}
        mode={kind === "live" ? "broadcast" : "conference"}
        onLeave={() => setConnection(null)}
      />
    </div>
  );
}
