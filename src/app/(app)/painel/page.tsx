import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { one } from "@/lib/queries";
import { languageLabel } from "@/lib/config";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge, EmptyState, PageHeader, Section } from "@/components/ui";
import { PlayIcon, RadioIcon, VideoIcon } from "@/components/icons";

export const metadata = { title: "Painel" };

const WEEK = 7 * 86_400_000;

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const now = await requestNow();
  const firstName = viewer.fullName.split(" ")[0];

  const [{ data: classes }, { data: lives }, { data: enrollments }, { data: unreadRows }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, title, language, starts_at, duration_min")
      .gte("starts_at", new Date(now - 3 * 3_600_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(4),
    supabase
      .from("lives")
      .select("id, title, status, scheduled_at")
      .neq("status", "ended")
      .order("scheduled_at", { ascending: true })
      .limit(4),
    supabase.from("enrollments").select("course_id").eq("user_id", viewer.id).eq("status", "active"),
    supabase
      .from("conversation_members")
      .select("last_read_at, conversation:conversations!inner(last_message_at)")
      .eq("user_id", viewer.id),
  ]);

  const nextClasses = (classes ?? []).filter(
    (c) => new Date(c.starts_at).getTime() + c.duration_min * 60_000 >= now,
  );
  const unread = (unreadRows ?? []).filter((r) => {
    const last = one(r.conversation as unknown as { last_message_at: string | null } | null)?.last_message_at;
    return last && last > (r.last_read_at as string);
  }).length;

  const courseIds = (enrollments ?? []).map((e) => e.course_id as string);
  if (viewer.isTeacher) {
    // Para o professor, a seção mostra os lançamentos dos cursos dele.
    const { data: own } = await supabase.from("courses").select("id").eq("teacher_id", viewer.id);
    for (const c of own ?? []) if (!courseIds.includes(c.id)) courseIds.push(c.id);
  }
  const { data: newEpisodes } = courseIds.length
    ? await supabase
        .from("episodes")
        .select("id, title, release_at, course:courses(slug, title)")
        .in("course_id", courseIds)
        .gte("release_at", new Date(now - WEEK).toISOString())
        .lte("release_at", new Date(now).toISOString())
        .order("release_at", { ascending: false })
        .limit(6)
    : { data: [] };

  let teacherStats: { students: number; courses: number; subscribers: number } | null = null;
  if (viewer.isTeacher) {
    const [students, courses, subscribers] = await Promise.all([
      supabase.from("teacher_students").select("student_id", { count: "exact", head: true }).eq("teacher_id", viewer.id),
      supabase.from("courses").select("id", { count: "exact", head: true }).eq("teacher_id", viewer.id),
      supabase
        .from("enrollments")
        .select("id, course:courses!inner(teacher_id)", { count: "exact", head: true })
        .eq("course.teacher_id", viewer.id)
        .eq("status", "active"),
    ]);
    teacherStats = {
      students: students.count ?? 0,
      courses: courses.count ?? 0,
      subscribers: subscribers.count ?? 0,
    };
  }

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}!`}
        description={viewer.isTeacher ? "Resumo das suas turmas, cursos e lives." : "O que vem por aí nos seus estudos."}
      />

      {teacherStats ? (
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <Stat label="Alunos" value={teacherStats.students} href="/alunos" />
          <Stat label="Cursos gravados" value={teacherStats.courses} href="/estudio" />
          <Stat label="Assinantes ativos" value={teacherStats.subscribers} href="/estudio" />
        </div>
      ) : null}

      {unread > 0 ? (
        <Link href="/mensagens" className="card mb-8 flex items-center justify-between gap-4 px-5 py-4 hover:border-accent/40">
          <span className="text-sm">
            Você tem <strong>{unread}</strong> conversa{unread === 1 ? "" : "s"} com mensagens novas.
          </span>
          <span className="text-sm font-medium text-accent">Abrir mensagens</span>
        </Link>
      ) : null}

      <div className="grid gap-x-8 lg:grid-cols-2">
        <Section
          title="Próximas aulas"
          action={
            <Link href="/aulas" className="text-sm text-accent hover:underline">
              Ver todas
            </Link>
          }
        >
          {nextClasses.length === 0 ? (
            <EmptyState title="Nenhuma aula marcada" description="Suas próximas aulas ao vivo aparecem aqui." />
          ) : (
            <ul className="space-y-2">
              {nextClasses.map((c) => (
                <li key={c.id}>
                  <Link href={`/aulas/${c.id}`} className="card flex items-center gap-3 px-4 py-3 hover:border-accent/40">
                    <VideoIcon size={18} className="shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted">{formatDateTime(c.starts_at)}</p>
                    </div>
                    <Badge tone="accent">{languageLabel(c.language)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Lives"
          action={
            <Link href="/lives" className="text-sm text-accent hover:underline">
              Ver agenda
            </Link>
          }
        >
          {(lives ?? []).length === 0 ? (
            <EmptyState title="Nenhuma live agendada" description="Quando um professor marcar uma live, ela aparece aqui." />
          ) : (
            <ul className="space-y-2">
              {(lives ?? []).map((l) => (
                <li key={l.id}>
                  <Link href={`/lives/${l.id}`} className="card flex items-center gap-3 px-4 py-3 hover:border-accent/40">
                    <RadioIcon size={18} className={`shrink-0 ${l.status === "live" ? "text-live" : "text-accent"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-muted">{formatDateTime(l.scheduled_at)}</p>
                    </div>
                    {l.status === "live" ? <Badge tone="live">Ao vivo</Badge> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Novos episódios esta semana"
        action={
          <Link href="/cursos" className="text-sm text-accent hover:underline">
            Cursos gravados
          </Link>
        }
      >
        {(newEpisodes ?? []).length === 0 ? (
          viewer.isTeacher ? (
            <EmptyState
              title="Nenhum episódio lançado nesta semana"
              description="Envie e agende o episódio da semana no Estúdio para manter os assinantes engajados."
              action={
                <Link href="/estudio" className="btn btn-primary btn-sm">
                  Ir para o Estúdio
                </Link>
              }
            />
          ) : (
            <EmptyState
              title={courseIds.length ? "Nada novo nesta semana" : "Você ainda não assina nenhum curso gravado"}
              description={
                courseIds.length
                  ? "Os episódios novos dos seus cursos aparecem aqui assim que forem lançados."
                  : "Os cursos gravados complementam suas aulas ao vivo, com episódios novos toda semana."
              }
              action={
                courseIds.length ? null : (
                  <Link href="/cursos" className="btn btn-primary btn-sm">
                    Conhecer os cursos
                  </Link>
                )
              }
            />
          )
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(newEpisodes ?? []).map((e) => {
              const course = one(e.course as unknown as { slug: string; title: string } | null);
              return (
                <li key={e.id}>
                  <Link href={`/cursos/${course?.slug}/${e.id}`} className="card flex h-full flex-col gap-1 p-4 hover:border-accent/40">
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <PlayIcon size={14} className="text-accent" /> {course?.title}
                    </span>
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="mt-auto pt-2 text-xs text-muted">{formatDate(e.release_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card px-5 py-4 hover:border-accent/40">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
