import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Person = { id: string; full_name: string };

/** Alunos do professor (lista de chamada). */
export async function getRoster(supabase: SupabaseClient, teacherId: string): Promise<Person[]> {
  const { data } = await supabase
    .from("teacher_students")
    .select("student:profiles!student_id(id, full_name)")
    .eq("teacher_id", teacherId);
  return (data ?? [])
    .map((r) => r.student as unknown as Person | null)
    .filter((p): p is Person => Boolean(p))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
}

/** Professores do aluno. */
export async function getTeachersOf(supabase: SupabaseClient, studentId: string): Promise<Person[]> {
  const { data } = await supabase
    .from("teacher_students")
    .select("teacher:profiles!teacher_id(id, full_name)")
    .eq("student_id", studentId);
  return (data ?? [])
    .map((r) => r.teacher as unknown as Person | null)
    .filter((p): p is Person => Boolean(p));
}

export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
