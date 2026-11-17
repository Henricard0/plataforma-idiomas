import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { one } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { Badge, PageHeader, Section } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/form-controls";
import { ArrowLeftIcon } from "@/components/icons";
import { CourseFields, type CourseFormValues } from "../course-form";
import { deleteCourse, deleteEpisode, revokeAccess, updateCourse } from "../actions";
import { EpisodeUploader } from "./episode-uploader";
import { GrantAccessForm } from "./grant-access-form";

export const metadata = { title: "Editar curso" };

const providerLabel: Record<string, string> = { stripe: "Pagamento", manual: "Liberado por você" };
const statusLabel: Record<string, string> = { active: "Ativo", pending: "Aguardando pagamento", canceled: "Cancelado" };

export default async function StudioCoursePage({ params }: PageProps<"/estudio/[id]">) {
  const { id } = await params;
  const viewer = await requireTeacher();
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, description, language, level, price_cents, currency, billing, published, teacher_id")
    .eq("id", id)
    .eq("teacher_id", viewer.id)
    .maybeSingle();
  if (!course) notFound();

  const [{ data: episodes }, { data: enrollments }] = await Promise.all([
    supabase
      .from("episodes")
      .select("id, title, release_at, is_free_preview, duration_sec")
      .eq("course_id", course.id)
      .order("release_at", { ascending: true }),
    supabase
      .from("enrollments")
      .select("id, status, provider, created_at, student:profiles!user_id(full_name)")
      .eq("course_id", course.id)
      .order("created_at", { ascending: false }),
  ]);

  const now = await requestNow();
  const list = episodes ?? [];

  return (
    <>
      <Link href="/estudio" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon size={15} /> Estúdio
      </Link>
      <PageHeader
        title={course.title}
        eyebrow={<Badge tone={course.published ? "accent" : "neutral"}>{course.published ? "Publicado" : "Rascunho"}</Badge>}
        actions={
          <Link href={`/cursos/${course.slug}`} className="btn btn-secondary">
            Ver como aluno
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <Section title={`Episódios (${list.length})`}>
            {list.length === 0 ? (
              <p className="text-sm text-muted">Nenhum episódio ainda. Envie o primeiro pelo painel ao lado.</p>
            ) : (
              <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
                {list.map((e, i) => {
                  const scheduled = new Date(e.release_at).getTime() > now;
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-6 shrink-0 text-sm text-muted">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="text-xs text-muted">
                          {scheduled ? "Sai em " : "Lançado em "}
                          {formatDateTime(e.release_at)}
                          {e.duration_sec ? ` · ${Math.max(1, Math.round(e.duration_sec / 60))} min` : ""}
                        </p>
                      </div>
                      {scheduled ? <Badge tone="warning">Agendado</Badge> : null}
                      {e.is_free_preview ? <Badge tone="accent">Prévia grátis</Badge> : null}
                      <form action={deleteEpisode}>
                        <input type="hidden" name="episode_id" value={e.id} />
                        <ConfirmSubmit message={`Excluir "${e.title}"? O vídeo será apagado.`}>Excluir</ConfirmSubmit>
                      </form>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          <Section title="Dados do curso">
            <form action={updateCourse} className="card space-y-4 p-5">
              <input type="hidden" name="course_id" value={course.id} />
              <CourseFields values={course as CourseFormValues} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="published" defaultChecked={course.published} className="accent-accent" />
                Publicado (aparece no catálogo para os alunos)
              </label>
              <div className="flex justify-end">
                <SubmitButton>Salvar alterações</SubmitButton>
              </div>
            </form>
          </Section>

          <Section title="Alunos com acesso">
            {(enrollments ?? []).length === 0 ? (
              <p className="text-sm text-muted">Ninguém ainda. Os alunos aparecem aqui quando comprarem ou quando você liberar.</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {(enrollments ?? []).map((en) => (
                  <li key={en.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="flex-1 truncate font-medium">
                      {one(en.student as unknown as { full_name: string } | null)?.full_name}
                    </span>
                    <Badge tone={en.status === "active" ? "accent" : en.status === "pending" ? "warning" : "neutral"}>
                      {statusLabel[en.status] ?? en.status}
                    </Badge>
                    <span className="hidden text-xs text-muted sm:inline">{providerLabel[en.provider]}</span>
                    {en.provider === "manual" ? (
                      <form action={revokeAccess}>
                        <input type="hidden" name="enrollment_id" value={en.id} />
                        <input type="hidden" name="course_id" value={course.id} />
                        <ConfirmSubmit message="Remover o acesso deste aluno?">Remover</ConfirmSubmit>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <form action={deleteCourse} className="border-t border-line pt-6">
            <input type="hidden" name="course_id" value={course.id} />
            <ConfirmSubmit message="Excluir o curso e todos os episódios? Isso não pode ser desfeito.">
              Excluir curso
            </ConfirmSubmit>
          </form>
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-1 font-semibold">Novo episódio</h2>
            <p className="mb-4 text-sm text-muted">Grave, envie e agende para o dia da semana em que sai episódio novo.</p>
            <EpisodeUploader viewerId={viewer.id} courseId={course.id} nextNumber={list.length + 1} />
          </div>
          <div className="card p-5">
            <h2 className="mb-1 font-semibold">Liberar acesso</h2>
            <p className="mb-4 text-sm text-muted">Dê o curso de bônus para um aluno das suas aulas particulares.</p>
            <GrantAccessForm courseId={course.id} />
          </div>
        </aside>
      </div>
    </>
  );
}
