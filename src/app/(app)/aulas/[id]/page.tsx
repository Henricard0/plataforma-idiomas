import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { getRoster, one, type Person } from "@/lib/queries";
import { languageLabel } from "@/lib/config";
import { formatDateTime, formatTime } from "@/lib/format";
import { Avatar, Badge, PageHeader, Section } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/form-controls";
import { ArrowLeftIcon } from "@/components/icons";
import { VideoRoom } from "@/components/video/video-room";
import { MaterialList, type MaterialItem } from "../../materiais/material-list";
import { MaterialUploader } from "../../materiais/material-uploader";
import { startDirectConversation } from "../../mensagens/actions";
import { deleteClass, updateClassStudents } from "../actions";

export default async function ClassPage({ params }: PageProps<"/aulas/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select(
      "id, title, language, starts_at, duration_min, notes, teacher_id, teacher:profiles!teacher_id(id, full_name), class_students(student:profiles!student_id(id, full_name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!cls) notFound();

  const teacher = one(cls.teacher as unknown as Person | null);
  const students = (cls.class_students ?? [])
    .map((r) => one(r.student as unknown as Person | null))
    .filter((p): p is Person => Boolean(p));
  const isOwner = cls.teacher_id === viewer.id;

  const { data: materialRows } = await supabase
    .from("materials")
    .select("id, title, description, file_name, size_bytes, created_at, teacher_id")
    .eq("class_id", cls.id)
    .order("created_at", { ascending: false });
  const materials: MaterialItem[] = (materialRows ?? []).map((m) => ({ ...m, classTitle: null }));

  const roster = isOwner ? await getRoster(supabase, viewer.id) : [];
  const studentIds = new Set(students.map((s) => s.id));

  const start = new Date(cls.starts_at);
  const end = new Date(start.getTime() + cls.duration_min * 60_000);
  const now = await requestNow();
  const happening = now >= start.getTime() && now <= end.getTime();

  return (
    <>
      <Link href="/aulas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon size={15} /> Aulas
      </Link>
      <PageHeader
        title={cls.title}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{languageLabel(cls.language)}</Badge>
            {happening ? <Badge tone="live">Acontecendo agora</Badge> : null}
          </span>
        }
        description={`${formatDateTime(start)} – ${formatTime(end)} · ${teacher ? `Professor(a) ${teacher.full_name}` : ""}`}
        actions={
          isOwner ? (
            <form action={deleteClass}>
              <input type="hidden" name="class_id" value={cls.id} />
              <ConfirmSubmit message="Cancelar esta aula? Os materiais da aula também serão removidos.">
                Cancelar aula
              </ConfirmSubmit>
            </form>
          ) : teacher ? (
            <form action={startDirectConversation}>
              <input type="hidden" name="user_id" value={teacher.id} />
              <SubmitButton className="btn btn-secondary" pendingLabel="Abrindo…">
                Mensagem para o professor
              </SubmitButton>
            </form>
          ) : null
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <VideoRoom
            kind="class"
            id={cls.id}
            joinLabel={happening ? "Entrar na aula" : "Entrar na sala"}
            description={
              happening
                ? "Câmera e microfone serão solicitados pelo navegador."
                : `A aula está marcada para ${formatDateTime(start)}. Você pode entrar antes para testar câmera e microfone.`
            }
          />
          {cls.notes ? (
            <div className="card mt-6 p-5">
              <h2 className="mb-2 text-sm font-semibold">Observações do professor</h2>
              <p className="text-sm whitespace-pre-wrap text-muted">{cls.notes}</p>
            </div>
          ) : null}

          <div className="mt-8">
            <Section title="Materiais desta aula">
              <MaterialList
                items={materials}
                viewerId={viewer.id}
                showAudience={false}
                emptyText={isOwner ? "Envie arquivos só para esta turma pelo painel ao lado." : "Nenhum material para esta aula."}
              />
            </Section>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">Participantes</h2>
            <ul className="space-y-2.5">
              {teacher ? (
                <li className="flex items-center gap-2.5 text-sm">
                  <Avatar name={teacher.full_name} size={28} />
                  <span className="flex-1 truncate">{teacher.full_name}</span>
                  <Badge>Professor</Badge>
                </li>
              ) : null}
              {students.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar name={s.full_name} size={28} />
                  <span className="flex-1 truncate">{s.full_name}</span>
                </li>
              ))}
            </ul>

            {isOwner && roster.length > 0 ? (
              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-medium text-accent">Editar alunos da aula</summary>
                <form action={updateClassStudents} className="mt-3 space-y-3">
                  <input type="hidden" name="class_id" value={cls.id} />
                  <div className="max-h-48 space-y-1.5 overflow-y-auto">
                    {roster.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="student_ids"
                          value={s.id}
                          defaultChecked={studentIds.has(s.id)}
                          className="accent-accent"
                        />
                        {s.full_name}
                      </label>
                    ))}
                  </div>
                  <SubmitButton className="btn btn-secondary btn-sm w-full">Salvar alunos</SubmitButton>
                </form>
              </details>
            ) : null}
          </div>

          {isOwner ? (
            <div className="card p-5">
              <h2 className="mb-4 text-sm font-semibold">Enviar material para a aula</h2>
              <MaterialUploader viewerId={viewer.id} fixedClassId={cls.id} />
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
