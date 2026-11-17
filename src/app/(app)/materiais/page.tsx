import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestNow } from "@/lib/time";
import { one } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { MaterialList, type MaterialItem } from "./material-list";
import { MaterialUploader } from "./material-uploader";

export const metadata = { title: "Materiais" };

export default async function MaterialsPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const { data } = await supabase
    .from("materials")
    .select(
      "id, title, description, file_name, size_bytes, created_at, teacher_id, teacher:profiles!teacher_id(full_name), class:classes(title)",
    )
    .order("created_at", { ascending: false });

  const items: MaterialItem[] = (data ?? []).map((m) => ({
    ...m,
    teacherName: one(m.teacher as unknown as { full_name: string } | null)?.full_name,
    classTitle: one(m.class as unknown as { title: string } | null)?.title,
  }));

  let classes: { id: string; title: string }[] = [];
  if (viewer.isTeacher) {
    const { data: cls } = await supabase
      .from("classes")
      .select("id, title, starts_at")
      .eq("teacher_id", viewer.id)
      .gte("starts_at", new Date((await requestNow()) - 30 * 86_400_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(30);
    classes = cls ?? [];
  }

  return (
    <>
      <PageHeader
        title="Materiais"
        description={
          viewer.isTeacher
            ? "Publique apostilas, exercícios e áudios para todos os seus alunos ou só para uma aula."
            : "Apostilas, exercícios e áudios que seus professores compartilharam com você."
        }
      />
      <div className={viewer.isTeacher ? "grid gap-8 lg:grid-cols-[1fr_340px]" : ""}>
        <MaterialList
          items={items}
          viewerId={viewer.id}
          emptyText={
            viewer.isTeacher
              ? "Publique o primeiro material pelo formulário ao lado."
              : "Quando seu professor compartilhar um material, ele aparece aqui."
          }
        />
        {viewer.isTeacher ? (
          <aside>
            <div className="card p-5 lg:sticky lg:top-8">
              <h2 className="mb-4 font-semibold">Novo material</h2>
              <MaterialUploader viewerId={viewer.id} classes={classes} />
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
