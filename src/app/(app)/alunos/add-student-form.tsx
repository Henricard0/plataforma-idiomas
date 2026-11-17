"use client";

import { useActionState } from "react";
import { addStudent, type RosterState } from "./actions";

export function AddStudentForm() {
  const [state, action, pending] = useActionState<RosterState, FormData>(addStudent, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="student-email">
          E-mail do aluno
        </label>
        <input id="student-email" name="email" type="email" required className="input" placeholder="aluno@email.com" />
      </div>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? <p className="text-sm text-accent">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Adicionando…" : "Adicionar aluno"}
      </button>
    </form>
  );
}
