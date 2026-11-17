import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Lê as chaves do LiveKit no momento da requisição, sem espaços colados por engano. */
function livekitConfig() {
  const env = process.env;
  const url = (env.LIVEKIT_URL ?? env["NEXT_PUBLIC_LIVEKIT_URL"] ?? "").trim();
  const apiKey = (env.LIVEKIT_API_KEY ?? "").trim();
  const apiSecret = (env.LIVEKIT_API_SECRET ?? "").trim();
  const missing = [
    !url && "NEXT_PUBLIC_LIVEKIT_URL",
    !apiKey && "LIVEKIT_API_KEY",
    !apiSecret && "LIVEKIT_API_SECRET",
  ].filter((name): name is string => Boolean(name));
  return { url, apiKey, apiSecret, missing };
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * Gera o token de acesso à sala do LiveKit.
 * Aula: só professor e alunos da aula entram, todos podem falar.
 * Live: o professor transmite; o público só assiste (e conversa pelo chat da página).
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return fail(401, "Faça login para entrar na sala.");
  const livekit = livekitConfig();
  if (livekit.missing.length > 0) {
    return fail(
      503,
      `O vídeo ainda não foi configurado. Falta no Vercel (Settings → Environment Variables): ${livekit.missing.join(", ")}.`,
    );
  }

  const body = (await request.json().catch(() => null)) as { kind?: string; id?: string } | null;
  if (!body?.id || (body.kind !== "class" && body.kind !== "live")) return fail(400, "Pedido inválido.");

  const supabase = await createClient();
  let roomName: string;
  let canPublish: boolean;
  let isAdmin: boolean;

  if (body.kind === "class") {
    // O RLS só devolve a aula para o professor e os alunos dela.
    const { data: cls } = await supabase
      .from("classes")
      .select("id, room_name, teacher_id")
      .eq("id", body.id)
      .maybeSingle();
    if (!cls) return fail(404, "Aula não encontrada, ou você não está nela.");
    roomName = cls.room_name;
    canPublish = true;
    isAdmin = cls.teacher_id === viewer.id;
  } else {
    const { data: live } = await supabase
      .from("lives")
      .select("id, room_name, host_id, status")
      .eq("id", body.id)
      .maybeSingle();
    if (!live) return fail(404, "Live não encontrada.");

    const isHost = live.host_id === viewer.id;
    if (!isHost) {
      if (live.status === "scheduled") return fail(409, "A live ainda não começou. A página atualiza sozinha quando começar.");
      if (live.status === "ended") return fail(409, "Esta live já terminou.");
      const { data: canWatch } = await supabase.rpc("can_watch_live", { p_live: live.id });
      if (!canWatch) return fail(403, "Esta live é exclusiva para alunos do curso.");
    }
    roomName = live.room_name;
    canPublish = isHost;
    isAdmin = isHost;
  }

  const token = new AccessToken(livekit.apiKey, livekit.apiSecret, {
    identity: viewer.id,
    name: viewer.fullName,
    ttl: "4h",
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    roomAdmin: isAdmin,
    canSubscribe: true,
    canPublish,
    // Nas aulas, o chat interno da chamada fica ativo; nas lives o chat é o da página.
    canPublishData: body.kind === "class",
  });

  return NextResponse.json({
    token: await token.toJwt(),
    serverUrl: livekit.url,
    canPublish,
  });
}
