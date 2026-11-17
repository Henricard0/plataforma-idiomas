import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { one } from "@/lib/queries";
import { LANGUAGES, languageLabel } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { Badge, EmptyState, Field, PageHeader, Section } from "@/components/ui";
import { DateTimeInput, SubmitButton } from "@/components/form-controls";
import { LockIcon } from "@/components/icons";
import { createLive } from "./actions";

export const metadata = { title: "Lives" };

type LiveRow = {
  id: string;
  title: string;
  description: string | null;
  language: string | null;
  status: "scheduled" | "live" | "ended";
  scheduled_at: string;
  course_id: string | null;
  host: { full_name: string } | null;
  course: { title: string } | null;
};

export default async function LivesPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const since = new Date((await requestNow()) - 30 * 86_400_000).toISOString();
  const [{ data }, { data: myCourses }] = await Promise.all([
    supabase
      .from("lives")
      .select("id, title, description, language, status, scheduled_at, course_id, host:profiles!host_id(full_name), course:courses(title)")
      .gte("scheduled_at", since)
      .order("scheduled_at", { ascending: true }),
    viewer.isTeacher
      ? supabase.from("courses").select("id, title").eq("teacher_id", viewer.id).order("title")
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const lives = ((data ?? []) as unknown as LiveRow[]).map((l) => ({ ...l, host: one(l.host), course: one(l.course) }));
  const onAir = lives.filter((l) => l.status === "live");
  const upcoming = lives.filter((l) => l.status === "scheduled");
  const ended = lives.filter((l) => l.status === "ended").reverse().slice(0, 8);

  return (
    <>
      <PageHeader
        title="Lives"
        description="Transmissões ao vivo para todos os alunos: aulões, tira-dúvidas, pronúncia e convidados."
      />

      <div className={viewer.isTeacher ? "grid gap-8 lg:grid-cols-[1fr_340px]" : ""}>
        <div>
          {onAir.length > 0 ? (
            <Section title="Ao vivo agora">
              <ul className="space-y-3">
                {onAir.map((l) => (
                  <LiveCard key={l.id} live={l} />
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Próximas lives">
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nenhuma live agendada"
                description={viewer.isTeacher ? "Agende uma live pelo formulário ao lado." : "Fique de olho: novas lives aparecem aqui."}
              />
            ) : (
              <ul className="space-y-3">
                {upcoming.map((l) => (
                  <LiveCard key={l.id} live={l} />
                ))}
              </ul>
            )}
          </Section>

          {ended.length > 0 ? (
            <Section title="Encerradas recentemente">
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {ended.map((l) => (
                  <li key={l.id}>
                    <Link href={`/lives/${l.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-paper">
                      <span className="truncate text-sm font-medium">{l.title}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDateTime(l.scheduled_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        {viewer.isTeacher ? (
          <aside>
            <div className="card p-5 lg:sticky lg:top-8">
              <h2 className="mb-4 font-semibold">Agendar live</h2>
              <form action={createLive} className="space-y-4">
                <Field label="Título" htmlFor="live-title">
                  <input id="live-title" name="title" required maxLength={140} className="input" placeholder="Ex.: Aulão de phrasal verbs" />
                </Field>
                <Field label="Descrição" htmlFor="live-description">
                  <textarea id="live-description" name="description" rows={2} className="input" />
                </Field>
                <Field label="Data e hora" htmlFor="live-date">
                  <DateTimeInput id="live-date" name="scheduled_at" required />
                </Field>
                <Field label="Idioma" htmlFor="live-language">
                  <select id="live-language" name="language" className="input" defaultValue="en">
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quem pode assistir" htmlFor="live-course">
                  <select id="live-course" name="course_id" className="input" defaultValue="">
                    <option value="">Todos os alunos da plataforma</option>
                    {(myCourses ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        Só assinantes de: {c.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <SubmitButton className="btn btn-primary w-full" pendingLabel="Agendando…">
                  Agendar live
                </SubmitButton>
              </form>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}

function LiveCard({ live }: { live: LiveRow }) {
  return (
    <li>
      <Link href={`/lives/${live.id}`} className="card flex flex-col gap-2 p-4 hover:border-accent/40 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {live.status === "live" ? <Badge tone="live">Ao vivo</Badge> : null}
            {live.language ? <Badge tone="accent">{languageLabel(live.language)}</Badge> : null}
            {live.course ? (
              <Badge tone="warning">
                <LockIcon size={12} /> {live.course.title}
              </Badge>
            ) : null}
          </div>
          <p className="font-medium">{live.title}</p>
          <p className="mt-0.5 text-sm text-muted">
            {formatDateTime(live.scheduled_at)}
            {live.host ? ` · com ${live.host.full_name}` : ""}
          </p>
        </div>
        <span className={`btn ${live.status === "live" ? "btn-live" : "btn-secondary"} shrink-0`}>
          {live.status === "live" ? "Assistir" : "Detalhes"}
        </span>
      </Link>
    </li>
  );
}
