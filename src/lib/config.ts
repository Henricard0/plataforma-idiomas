// Ajuste aqui o nome da escola, idiomas oferecidos e fuso horário.
export const APP_NAME = "Língua Viva";
export const APP_TAGLINE = "Aulas ao vivo, cursos gravados e uma comunidade para praticar.";
export const APP_TIMEZONE = "America/Sao_Paulo";

export const LANGUAGES = [
  { code: "en", label: "Inglês" },
  { code: "es", label: "Espanhol" },
  { code: "fr", label: "Francês" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Alemão" },
  { code: "pt", label: "Português" },
] as const;

export const LEVELS = ["Iniciante", "Básico", "Intermediário", "Avançado", "Conversação"] as const;

export function languageLabel(code: string | null | undefined) {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code ?? "";
}
