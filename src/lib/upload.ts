"use client";

import { getBrowserClient } from "@/lib/supabase/client";

/** Nome de arquivo seguro para o storage (sem acentos, espaços ou barras). */
export function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) : "";
  return `${Date.now()}-${base || "arquivo"}${ext ? `.${ext}` : ""}`;
}

/** Envia o arquivo direto do navegador para o Supabase Storage. Retorna o caminho salvo. */
export async function uploadToBucket(bucket: string, folder: string, file: File) {
  const path = `${folder}/${safeFileName(file.name)}`;
  const { error } = await getBrowserClient()
    .storage.from(bucket)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) {
    const tooBig = /size|large|exceed/i.test(error.message);
    throw new Error(
      tooBig
        ? "O arquivo passou do tamanho máximo permitido no Storage. Aumente o limite no Supabase ou envie um arquivo menor."
        : "Não foi possível enviar o arquivo. Tente de novo.",
    );
  }
  return path;
}

export async function removeFromBucket(bucket: string, path: string) {
  await getBrowserClient().storage.from(bucket).remove([path]);
}

/** Lê a duração (em segundos) de um arquivo de vídeo no navegador. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}
