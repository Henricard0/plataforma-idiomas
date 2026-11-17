"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

/** Atualiza a página quando o professor inicia ou encerra a live. */
export function LiveStatusWatcher({ liveId, status }: { liveId: string; status: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`live:${liveId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lives", filter: `id=eq.${liveId}` },
        (payload) => {
          if ((payload.new as { status?: string }).status !== status) router.refresh();
        },
      );

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [liveId, status, router]);

  return null;
}
