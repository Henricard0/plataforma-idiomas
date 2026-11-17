/** Aceita só caminhos internos ("/painel"), nunca URLs externas, para evitar open redirect. */
export function safePath(value: FormDataEntryValue | string | null | undefined, fallback = "/painel") {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
