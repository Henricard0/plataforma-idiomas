import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/form-controls";
import { startDirectConversation } from "../mensagens/actions";
import { removeStudent } from "./actions";
import { AddStudentForm } from "./add-student-form";

export const metadata = { title: "Meus alunos" };

export default async function StudentsPage() {
  const viewer = await requireTeacher();
  const supabase = await createClient();

  const { data } = await supabase
    .from("teacher_students")
    .select("created_at, student:profiles!student_id(id, full_name)")
    .eq("teacher_id", viewer.id)
    .order("created_at", { ascending: false });

  const students = (data ?? [])
    .map((r) => ({ since: r.created_at as string, ...one(r.student as unknown as { id: string; full_name: string } | null)! }))
    .filter((s) => s.id);

  return (
    <>
      <PageHeader
        title="Meus alunos"
        description="Seus alunos das aulas ao vivo. Eles recebem seus materiais, entram nas suas aulas e podem conversar com você."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {students.length === 0 ? (
            <EmptyState
              title="Nenhum aluno ainda"
              description="Peça para o aluno criar a conta na plataforma e adicione pelo e-mail dele."
            />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {students.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={s.full_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted">Aluno(a) desde {formatDate(s.since)}</p>
                  </div>
                  <form action={startDirectConversation}>
                    <input type="hidden" name="user_id" value={s.id} />
                    <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Abrindo…">
                      Mensagem
                    </SubmitButton>
                  </form>
                  <form action={removeStudent}>
                    <input type="hidden" name="student_id" value={s.id} />
                    <ConfirmSubmit message={`Remover ${s.full_name} dos seus alunos? Ele(a) perde acesso aos seus materiais gerais.`}>
                      Remover
                    </ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside>
          <div className="card p-5 lg:sticky lg:top-8">
            <h2 className="mb-1 font-semibold">Adicionar aluno</h2>
            <p className="mb-4 text-sm text-muted">O aluno precisa ter criado a conta antes, pelo link de cadastro do site.</p>
            <AddStudentForm />
          </div>
        </aside>
      </div>
    </>
  );
}
