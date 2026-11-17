import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { one } from "@/lib/queries";
import { languageLabel } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Cursos gravados" };

const WEEK = 7 * 86_400_000;

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  language: string;
  level: string | null;
  price_cents: number;
  currency: string;
  billing: "one_time" | "monthly";
  teacher_id: string;
  teacher: { full_name: string } | null;
  episodes: { id: string; release_at: string }[];
};

export default async function CoursesPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const [{ data: courseRows }, { data: enrollments }] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, slug, title, description, language, level, price_cents, currency, billing, teacher_id, teacher:profiles!teacher_id(full_name), episodes(id, release_at)",
      )
      .eq("published", true)
      .order("created_at", { ascending: false }),
    supabase.from("enrollments").select("course_id, status").eq("user_id", viewer.id),
  ]);

  const statusByCourse = new Map((enrollments ?? []).map((e) => [e.course_id as string, e.status as string]));
  const now = await requestNow();
  const courses = ((courseRows ?? []) as unknown as CourseRow[]).map((c) => {
    const released = c.episodes.filter((e) => new Date(e.release_at).getTime() <= now);
    return {
      ...c,
      teacher: one(c.teacher),
      episodeCount: released.length,
      newThisWeek: released.filter((e) => now - new Date(e.release_at).getTime() < WEEK).length,
      hasAccess:
        c.teacher_id === viewer.id || c.price_cents === 0 || statusByCourse.get(c.id) === "active",
    };
  });

  const mine = courses.filter((c) => c.hasAccess && c.teacher_id !== viewer.id);
  const others = courses.filter((c) => !c.hasAccess || c.teacher_id === viewer.id);

  return (
    <>
      <PageHeader
        title="Cursos gravados"
        description="Aulas gravadas pelos professores, com episódios novos toda semana. Assista no seu ritmo, além das aulas ao vivo."
        actions={
          viewer.isTeacher ? (
            <Link href="/estudio" className="btn btn-secondary">
              Gerenciar meus cursos
            </Link>
          ) : null
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          title="Nenhum curso publicado ainda"
          description={
            viewer.isTeacher
              ? "Crie um curso no Estúdio, envie os primeiros episódios e publique."
              : "Os professores estão preparando os primeiros cursos. Volte em breve!"
          }
        />
      ) : (
        <>
          {mine.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-3 text-base font-semibold">Seus cursos</h2>
              <CourseGrid courses={mine} />
            </section>
          ) : null}
          {others.length > 0 ? (
            <section>
              {mine.length > 0 ? <h2 className="mb-3 text-base font-semibold">Catálogo</h2> : null}
              <CourseGrid courses={others} />
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function CourseGrid({
  courses,
}: {
  courses: (Omit<CourseRow, "teacher"> & {
    teacher: { full_name: string } | null;
    episodeCount: number;
    newThisWeek: number;
    hasAccess: boolean;
  })[];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <li key={c.id}>
          <Link
            href={`/cursos/${c.slug}`}
            className="card flex h-full flex-col p-5 transition-colors hover:border-accent/40"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="accent">{languageLabel(c.language)}</Badge>
              {c.level ? <Badge>{c.level}</Badge> : null}
              {c.newThisWeek > 0 ? (
                <Badge tone="warning">
                  {c.newThisWeek} {c.newThisWeek === 1 ? "novo" : "novos"} esta semana
                </Badge>
              ) : null}
            </div>
            <h3 className="font-display text-lg leading-snug font-semibold">{c.title}</h3>
            {c.teacher ? <p className="mt-1 text-sm text-muted">com {c.teacher.full_name}</p> : null}
            {c.description ? <p className="mt-3 line-clamp-3 text-sm text-muted">{c.description}</p> : null}
            <div className="mt-auto flex items-end justify-between gap-2 pt-5">
              <span className="text-sm text-muted">
                {c.episodeCount} episódio{c.episodeCount === 1 ? "" : "s"}
              </span>
              {c.hasAccess ? (
                <span className="text-sm font-medium text-accent">Assistir</span>
              ) : (
                <span className="text-sm font-semibold">
                  {c.price_cents === 0 ? "Grátis" : formatPrice(c.price_cents, c.currency)}
                  {c.billing === "monthly" && c.price_cents > 0 ? (
                    <span className="font-normal text-muted">/mês</span>
                  ) : null}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
