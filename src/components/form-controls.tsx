"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Botão de envio que mostra estado de carregamento enquanto a Server Action roda. */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn btn-primary",
  formAction,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} formAction={formAction}>
      {pending ? (pendingLabel ?? "Salvando…") : children}
    </button>
  );
}

/**
 * Campo de data e hora no fuso do navegador.
 * Envia no formulário um ISO em UTC (campo `name`), evitando confusão de fuso no servidor.
 */
export function DateTimeInput({
  name,
  id,
  required,
  defaultValue,
}: {
  name: string;
  id: string;
  required?: boolean;
  /** ISO string ou "now". O valor padrão só é calculado no navegador (fuso local). */
  defaultValue?: string;
}) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [edited, setEdited] = useState<string | null>(null);
  const fallback =
    mounted && defaultValue ? toLocalInputValue(defaultValue === "now" ? new Date() : new Date(defaultValue)) : "";
  const local = edited ?? fallback;
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <>
      <input
        id={id}
        type="datetime-local"
        className="input"
        required={required}
        value={local}
        onChange={(e) => setEdited(e.target.value)}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}

const noopSubscribe = () => () => {};

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ConfirmSubmit({
  children,
  message,
  className = "btn btn-danger btn-sm",
}: {
  children: ReactNode;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
