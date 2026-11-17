"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { SendIcon } from "@/components/icons";

export type ChatMessage = {
  id: number;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/**
 * Chat em tempo real (Supabase Realtime). Usado em mensagens diretas, grupos,
 * comunidades e lives. O RLS decide quem lê e quem escreve em cada conversa.
 */
export function ChatPanel({
  conversationId,
  viewerId,
  initialMessages,
  people,
  trackRead = false,
  readOnly = false,
  placeholder = "Escreva uma mensagem…",
  className = "h-[60vh]",
}: {
  conversationId: string;
  viewerId: string;
  initialMessages: ChatMessage[];
  people: Record<string, string>;
  trackRead?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [names, setNames] = useState<Record<string, string>>(people);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const namesRef = useRef(names);
  useEffect(() => {
    namesRef.current = names;
  }, [names]);

  // Assina novas mensagens desta conversa.
  useEffect(() => {
    const supabase = getBrowserClient();
    let active = true;

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const message = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
          if (!namesRef.current[message.sender_id]) {
            const { data } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", message.sender_id)
              .maybeSingle();
            if (active && data) setNames((prev) => ({ ...prev, [message.sender_id]: data.full_name }));
          }
        },
      );

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Rola para a última mensagem e marca como lida.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (trackRead) {
      getBrowserClient()
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", viewerId)
        .then(() => undefined);
    }
  }, [messages.length, trackRead, conversationId, viewerId]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error: insertError } = await getBrowserClient()
      .from("messages")
      .insert({ conversation_id: conversationId, body })
      .select("id, conversation_id, sender_id, body, created_at")
      .single();
    setSending(false);
    if (insertError || !data) {
      setError("A mensagem não foi enviada. Confira sua conexão e tente de novo.");
      return;
    }
    setDraft("");
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMessage]));
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className={`card flex flex-col overflow-hidden ${className}`}>
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Nenhuma mensagem ainda. Diga olá!</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === viewerId;
            const grouped = i > 0 && messages[i - 1].sender_id === m.sender_id;
            const name = mine ? "Você" : (names[m.sender_id] ?? "…");
            return (
              <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""} ${grouped ? "-mt-2" : ""}`}>
                <div className="w-8 shrink-0">{grouped ? null : <Avatar name={mine ? "Você" : name} size={32} />}</div>
                <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  {grouped ? null : (
                    <span className="mb-1 text-xs text-muted">
                      {name} · {formatTime(m.created_at)}
                    </span>
                  )}
                  <p
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                      mine ? "bg-accent text-white" : "bg-paper text-ink"
                    }`}
                  >
                    {m.body}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {readOnly ? null : (
        <form onSubmit={send} className="border-t border-line p-3">
          {error ? (
            <p className="mb-2 text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <label htmlFor={`chat-input-${conversationId}`} className="sr-only">
              Mensagem
            </label>
            <textarea
              id={`chat-input-${conversationId}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder={placeholder}
              className="input max-h-32 min-h-10 resize-none"
            />
            <button type="submit" className="btn btn-primary px-3" disabled={sending || !draft.trim()} aria-label="Enviar">
              <SendIcon size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
