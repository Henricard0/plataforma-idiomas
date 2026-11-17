import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { languageLabel } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/form-controls";
import { CourseFields } from "./course-form";
import { createCourse } from "./actions";

export const metadata = { title: "Estúdio de cursos" };

export default async function StudioPage() {
  const viewer = await requireTeacher();
  const supabase = await createClient();

  const { data } = await supabase
    .from("courses")
    .select("id, slug, title, language, price_cents, currency, billing, published, episodes(id, release_at), enrollments(status)")
    .eq("teacher_id", viewer.id)
    .order("created_at", { ascending: false });

  const now = await requestNow();
  const courses = (data ?? []).map((c) => {
    const episodes = (c.episodes ?? []) as { release_at: string }[];
    return {
      ...c,
      released: episodes.filter((e) => new Date(e.release_at).getTime() <= now).length,
      scheduled: episodes.filter((e) => new Date(e.release_at).getTime() > now).length,
      students: ((c.enrollments ?? []) as { status: string }[]).filter((e) => e.status === "active").length,
    };
  });

  return (
    <>
      <PageHeader
        title="Estúdio de cursos"
        description="Crie cursos gravados, agende os episódios da semana e acompanhe quantos alunos assinam."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          {courses.length === 0 ? (
            <EmptyState
              title="Você ainda não tem cursos"
              description="Crie o primeiro pelo formulário. Ele começa como rascunho até você publicar."
            />
          ) : (
            <ul className="space-y-3">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link href={`/estudio/${c.id}`} className="card flex flex-col gap-3 p-4 hover:border-accent/40 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap gap-2">
                        <Badge tone={c.published ? "accent" : "neutral"}>{c.published ? "Publicado" : "Rascunho"}</Badge>
                        <Badge>{languageLabel(c.language)}</Badge>
                      </div>
                      <p className="font-medium">{c.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {c.released} episódio{c.released === 1 ? "" : "s"}
                        {c.scheduled ? ` · ${c.scheduled} agendado${c.scheduled === 1 ? "" : "s"}` : ""} ·{" "}
                        {c.price_cents === 0
                          ? "Grátis"
                          : `${formatPrice(c.price_cents, c.currency)}${c.billing === "monthly" ? "/mês" : ""}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-xl font-semibold">{c.students}</p>
                      <p className="text-xs text-muted">aluno{c.students === 1 ? "" : "s"} com acesso</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside>
          <div className="card p-5 lg:sticky lg:top-8">
            <h2 className="mb-4 font-semibold">Novo curso</h2>
            <form action={createCourse} className="space-y-4">
              <CourseFields />
              <SubmitButton className="btn btn-primary w-full" pendingLabel="Criando…">
                Criar curso
              </SubmitButton>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
