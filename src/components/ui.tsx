import type { ReactNode } from "react";
import { initials } from "@/lib/format";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 text-sm text-muted">{eyebrow}</div> : null}
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 border-dashed px-6 py-8">
      <p className="font-medium text-ink">{title}</p>
      {description ? <p className="max-w-lg text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

type BadgeTone = "neutral" | "accent" | "live" | "warning";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-black/5 text-muted",
  accent: "bg-accent-soft text-accent",
  live: "bg-live text-white",
  warning: "bg-amber-100 text-amber-800",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ${toneClasses[tone]}`}
    >
      {tone === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-white" /> : null}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 32 }: { name: string | null | undefined; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-medium text-accent"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-black/5 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <Skeleton className="mb-3 h-9 w-64" />
      <Skeleton className="mb-10 h-5 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: ReactNode }) {
  const cls =
    tone === "success"
      ? "border-accent/30 bg-accent-soft text-accent"
      : tone === "error"
        ? "border-red-200 bg-red-50 text-danger"
        : "border-line bg-surface text-muted";
  return <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
