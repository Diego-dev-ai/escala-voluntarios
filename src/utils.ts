import type { Period, Signup, Slot } from "./types";

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function currentSlug() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} de ${year}`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${date}T12:00:00`));
}

export function isPast(date: string) {
  const d = new Date(`${date}T23:59:59`);
  return d < new Date();
}

export function sundayContext(date: string) {
  const today = new Date();
  const d = new Date(`${date}T12:00:00`);
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - a.getTime()) / 86400000);
  if (diff < 0) return "já passou";
  if (diff === 0) return "HOJE";
  if (diff === 7) return "próximo domingo";
  return `daqui ${diff} dias`;
}

export function periodLabel(period: Period) {
  return period === "morning" ? "Manhã" : "Noite";
}

export function defaultTimes(period: Period) {
  return period === "morning"
    ? { arrival: "9h15", service: "10h" }
    : { arrival: "18h15", service: "19h" };
}

export function selectedCount(signups: Signup[], volunteerId: string) {
  return signups.filter(s => s.volunteer_id === volunteerId).length;
}

export function slotSignupCount(signups: Signup[], slotId: string) {
  return signups.filter(s => s.slot_id === slotId).length;
}

export function generateSundays(year: number, month: number) {
  const result: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 0) {
      result.push(`${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}
