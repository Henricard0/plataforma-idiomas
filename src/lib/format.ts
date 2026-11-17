import { APP_TIMEZONE } from "./config";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeOnly = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value: string | Date) {
  return dateTime.format(new Date(value));
}

export function formatDate(value: string | Date) {
  return dateOnly.format(new Date(value));
}

export function formatTime(value: string | Date) {
  return timeOnly.format(new Date(value));
}

export function formatPrice(cents: number, currency = "brl") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Converte "R$ 49,90" / "49.90" / "49" em centavos. */
export function parsePriceToCents(input: string) {
  const cleaned = input.replace(/[^\d,.]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
