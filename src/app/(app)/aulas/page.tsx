import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { getRoster, one } from "@/lib/queries";
import { LANGUAGES, languageLabel } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { Badge, EmptyState, Field, PageHeader, Section } from "@/components/ui";
import { DateTimeInput, SubmitButton } from "@/components/form-controls";
import { CalendarIcon } from "@/components/icons";
import { createClass } from "./actions";

export const metadata = { title: "Aulas ao vivo" };

type ClassRow = {
  id: string;
  title: string;
  language: string;
  starts_at: string;
  duration_min: number;
  teacher: { full_name: string } | null;
  class_students: { student_id: string }[];
};

export default async function ClassesPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data } = await supabase
    .from("classes")
    .select("id, title, language, starts_at, duration_min, teacher:profiles!teacher_id(full_name), class_students(student_id)")
    .order("starts_at", { ascending: true });

  const classes = (data ?? []).map((c) => ({ ...c, teacher: one(c.teacher) })) as ClassRow[];
  const now = await requestNow();
  const endOf = (c: ClassRow) => new Date(c.starts_at).getTime() + c.duration_min * 60_000;
  const upcoming = classes.filter((c) => endOf(c) >= now);
  const past = classes.filter((c) => endOf(c) < now).reverse().slice(0, 12);

  const roster = viewer.isTeacher ? await getRoster(supabase, viewer.id) : [];

  return (
    <>
      <PageHeader
        title="Aulas ao vivo"
        description={
          viewer.isTeacher
            ? "Agende aulas com seus alunos. Na hora, é só entrar na sala de vídeo pela plataforma."
            : "Suas aulas com o professor. A sala abre 15 minutos antes do horário."
        }
      />

      <div className={viewer.isTeacher ? "grid gap-8 lg:grid-cols-[1fr_360px]" : ""}>
        <div>
          <Section title="Próximas aulas">
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nenhuma aula agendada"
                description={
                  viewer.isTeacher
                    ? "Use o formulário ao lado para agendar a primeira aula."
                    : "Quando seu professor agendar uma aula com você, ela aparece aqui."
                }
              />
            ) : (
              <ul className="space-y-3">
                {upcoming.map((c) => (
                  <ClassCard key={c.id} cls={c} now={now} isTeacher={viewer.isTeacher} />
                ))}
              </ul>
            )}
          </Section>

          {past.length > 0 ? (
            <Section title="Aulas anteriores">
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {past.map((c) => (
                  <li key={c.id}>
                    <Link href={`/aulas/${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-paper">
                      <span className="truncate text-sm font-medium">{c.title}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDateTime(c.starts_at)}</span>
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
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <CalendarIcon size={18} /> Agendar aula
              </h2>
              <form action={createClass} className="space-y-4">
                <Field label="Título" htmlFor="title">
                  <input id="title" name="title" required maxLength={140} className="input" placeholder="Ex.: Conversação B1" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Idioma" htmlFor="language">
                    <select id="language" name="language" className="input" required defaultValue="en">
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Duração" htmlFor="duration_min">
                    <select id="duration_min" name="duration_min" className="input" defaultValue="60">
                      {[30, 45, 60, 90, 120].map((m) => (
                        <option key={m} value={m}>
                          {m} min
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Data e hora" htmlFor="starts_at">
                  <DateTimeInput id="starts_at" name="starts_at" required />
                </Field>
                <fieldset>
                  <legend className="label">Alunos</legend>
                  {roster.length === 0 ? (
                    <p className="text-sm text-muted">
                      Você ainda não tem alunos.{" "}
                      <Link href="/alunos" className="text-accent hover:underline">
                        Adicionar alunos
                      </Link>
                    </p>
                  ) : (
                    <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-line p-2">
                      {roster.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-paper">
                          <input type="checkbox" name="student_ids" value={s.id} className="accent-accent" />
                          {s.full_name}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
                <Field label="Observações" htmlFor="notes">
                  <textarea id="notes" name="notes" rows={2} className="input" placeholder="Tema da aula, lição de casa…" />
                </Field>
                <SubmitButton className="btn btn-primary w-full" pendingLabel="Agendando…">
                  Agendar aula
                </SubmitButton>
              </form>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}

function ClassCard({ cls, now, isTeacher }: { cls: ClassRow; now: number; isTeacher: boolean }) {
  const start = new Date(cls.starts_at).getTime();
  const end = start + cls.duration_min * 60_000;
  const open = now >= start - 15 * 60_000 && now <= end;
  const happening = now >= start && now <= end;

  return (
    <li className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge tone="accent">{languageLabel(cls.language)}</Badge>
          {happening ? <Badge tone="live">Acontecendo agora</Badge> : null}
        </div>
        <Link href={`/aulas/${cls.id}`} className="font-medium hover:underline">
          {cls.title}
        </Link>
        <p className="mt-0.5 text-sm text-muted">
          {formatDateTime(cls.starts_at)} · {cls.duration_min} min
          {isTeacher
            ? ` · ${cls.class_students.length} aluno${cls.class_students.length === 1 ? "" : "s"}`
            : cls.teacher
              ? ` · com ${cls.teacher.full_name}`
              : ""}
        </p>
      </div>
      <Link href={`/aulas/${cls.id}`} className={`btn ${open ? "btn-primary" : "btn-secondary"} shrink-0`}>
        {open ? "Entrar na sala" : "Detalhes"}
      </Link>
    </li>
  );
}
