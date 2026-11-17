"use client";

import Link from "next/link";
import { ExternalIcon, VideoIcon } from "@/components/icons";

/**
 * Abre a sala de vídeo numa janela separada (no celular, numa nova aba), para a pessoa
 * continuar navegando na plataforma sem derrubar a chamada.
 */
export function CallLauncher({
  href,
  windowName,
  label,
  description,
}: {
  href: string;
  /** Nome da janela: clicar de novo só traz a janela já aberta para frente, sem recarregar a chamada. */
  windowName: string;
  label: string;
  description?: string;
}) {
  function openWindow() {
    const width = Math.min(1280, window.screen.availWidth);
    const height = Math.min(820, window.screen.availHeight);
    const left = Math.max(0, (window.screen.availWidth - width) / 2);
    const top = Math.max(0, (window.screen.availHeight - height) / 2);

    // Abre (ou reaproveita) a janela sem endereço primeiro: se ela já existir, não recarrega.
    const popup = window.open("", windowName, `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
    if (!popup) {
      // Pop-up bloqueado: abre a sala nesta aba mesmo.
      window.location.assign(href);
      return;
    }
    let isBlank = true;
    try {
      isBlank = popup.location.href === "about:blank";
    } catch {
      isBlank = false;
    }
    if (isBlank) popup.location.href = href;
    popup.focus();
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-xl bg-[#111] px-6 text-center text-white">
      <span className="flex size-12 items-center justify-center rounded-full bg-white/10">
        <VideoIcon size={22} />
      </span>
      {description ? <p className="max-w-sm text-sm text-white/70">{description}</p> : null}
      <button type="button" className="btn btn-primary" onClick={openWindow}>
        <ExternalIcon size={16} /> {label}
      </button>
      <p className="max-w-sm text-xs text-white/50">
        A chamada abre numa janela separada, para você continuar usando a plataforma.{" "}
        <Link href={href} className="underline hover:text-white/80">
          Prefiro abrir nesta aba
        </Link>
      </p>
    </div>
  );
}
