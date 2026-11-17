"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DateTimeInput } from "@/components/form-controls";
import { readVideoDuration, removeFromBucket, uploadToBucket } from "@/lib/upload";
import { createEpisode } from "../actions";

export function EpisodeUploader({ viewerId, courseId, nextNumber }: { viewerId: string; courseId: string; nextNumber: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("video");
    if (!(file instanceof File) || file.size === 0) {
      setError("Escolha o arquivo de vídeo.");
      return;
    }

    setStatus("uploading");
    setError(null);
    let path: string | null = null;
    try {
      const durationSec = await readVideoDuration(file);
      path = await uploadToBucket("course-videos", `${viewerId}/${courseId}`, file);
      const result = await createEpisode({
        courseId,
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        releaseAt: String(form.get("release_at") ?? ""),
        isFreePreview: form.get("is_free_preview") === "on",
        videoPath: path,
        durationSec,
      });
      if (result.error) throw new Error(result.error);
      formRef.current?.reset();
      setFormKey((k) => k + 1);
      setStatus("done");
      router.refresh();
    } catch (err) {
      if (path) await removeFromBucket("course-videos", path);
      setError(err instanceof Error ? err.message : "Não foi possível enviar o episódio.");
      setStatus("idle");
    }
  }

  return (
    <form key={formKey} ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="ep-title">
          Título
        </label>
        <input
          id="ep-title"
          name="title"
          required
          maxLength={200}
          className="input"
          defaultValue={`Episódio ${nextNumber}`}
        />
      </div>
      <div>
        <label className="label" htmlFor="ep-description">
          Descrição (opcional)
        </label>
        <textarea id="ep-description" name="description" rows={2} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="ep-video">
          Vídeo
        </label>
        <input
          id="ep-video"
          name="video"
          type="file"
          accept="video/*"
          required
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-paper"
        />
        <p className="hint">MP4 (H.264) funciona em todos os navegadores.</p>
      </div>
      <div>
        <label className="label" htmlFor="ep-release">
          Lançamento
        </label>
        <DateTimeInput id="ep-release" name="release_at" defaultValue="now" required />
        <p className="hint">Escolha uma data futura para agendar o episódio da semana.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_free_preview" className="accent-accent" />
        Prévia grátis (qualquer aluno pode assistir)
      </label>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {status === "done" ? <p className="text-sm text-accent">Episódio salvo.</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={status === "uploading"}>
        {status === "uploading" ? "Enviando vídeo…" : "Adicionar episódio"}
      </button>
    </form>
  );
}
