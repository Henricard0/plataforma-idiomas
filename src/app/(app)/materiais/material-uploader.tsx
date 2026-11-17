"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { removeFromBucket, uploadToBucket } from "@/lib/upload";
import { createMaterial } from "./actions";

export function MaterialUploader({
  viewerId,
  classes = [],
  fixedClassId,
}: {
  viewerId: string;
  classes?: { id: string; title: string }[];
  fixedClassId?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Escolha um arquivo.");
      return;
    }

    setStatus("uploading");
    setError(null);
    let path: string | null = null;
    try {
      path = await uploadToBucket("materials", viewerId, file);
      const result = await createMaterial({
        title: String(form.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, ""),
        description: String(form.get("description") ?? ""),
        classId: fixedClassId ?? (String(form.get("class_id") ?? "") || null),
        filePath: path,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      if (result.error) throw new Error(result.error);
      formRef.current?.reset();
      setTitle("");
      setStatus("done");
      router.refresh();
    } catch (err) {
      if (path) await removeFromBucket("materials", path);
      setError(err instanceof Error ? err.message : "Não foi possível enviar o material.");
      setStatus("idle");
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="material-file">
          Arquivo
        </label>
        <input
          id="material-file"
          name="file"
          type="file"
          required
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-paper"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
            setStatus("idle");
          }}
        />
        <p className="hint">PDF, áudio, slides, planilhas… qualquer formato.</p>
      </div>
      <div>
        <label className="label" htmlFor="material-title">
          Título (opcional)
        </label>
        <input
          id="material-title"
          name="title"
          maxLength={200}
          className="input"
          placeholder="Se ficar vazio, usamos o nome do arquivo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="material-description">
          Descrição (opcional)
        </label>
        <textarea id="material-description" name="description" rows={2} className="input" />
      </div>
      {fixedClassId ? null : (
        <div>
          <label className="label" htmlFor="material-class">
            Quem pode ver
          </label>
          <select id="material-class" name="class_id" className="input" defaultValue="">
            <option value="">Todos os meus alunos</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Só a aula: {c.title}
              </option>
            ))}
          </select>
        </div>
      )}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {status === "done" ? <p className="text-sm text-accent">Material publicado.</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={status === "uploading"}>
        {status === "uploading" ? "Enviando…" : "Publicar material"}
      </button>
    </form>
  );
}
