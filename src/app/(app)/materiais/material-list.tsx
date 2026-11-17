import { formatBytes, formatDate } from "@/lib/format";
import { ConfirmSubmit } from "@/components/form-controls";
import { DownloadIcon, FileIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { deleteMaterial } from "./actions";

export type MaterialItem = {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
  teacher_id: string;
  teacherName?: string | null;
  classTitle?: string | null;
};

export function MaterialList({
  items,
  viewerId,
  emptyText,
  showAudience = true,
}: {
  items: MaterialItem[];
  viewerId: string;
  emptyText: string;
  /** Mostra para quem o material foi compartilhado (desligado na página da própria aula). */
  showAudience?: boolean;
}) {
  if (items.length === 0) return <EmptyState title="Nenhum material ainda" description={emptyText} />;

  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {items.map((m) => (
        <li key={m.id} className="flex items-start gap-3 px-4 py-3.5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <FileIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{m.title}</p>
            {m.description ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{m.description}</p> : null}
            <p className="mt-1 text-xs text-muted">
              {[
                m.teacherName && m.teacher_id !== viewerId ? m.teacherName : null,
                !showAudience
                  ? null
                  : m.classTitle
                    ? `Aula: ${m.classTitle}`
                    : m.teacher_id === viewerId
                      ? "Todos os alunos"
                      : null,
                formatBytes(m.size_bytes),
                formatDate(m.created_at),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={`/materiais/${m.id}/download`} className="btn btn-secondary btn-sm" title={`Baixar ${m.file_name}`}>
              <DownloadIcon size={15} /> Baixar
            </a>
            {m.teacher_id === viewerId ? (
              <form action={deleteMaterial}>
                <input type="hidden" name="material_id" value={m.id} />
                <ConfirmSubmit message={`Excluir "${m.title}"? Os alunos perdem o acesso.`}>Excluir</ConfirmSubmit>
              </form>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
