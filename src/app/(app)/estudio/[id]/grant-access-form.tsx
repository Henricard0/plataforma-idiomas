"use client";

import { useActionState } from "react";
import { grantAccess, type AccessState } from "../actions";

export function GrantAccessForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<AccessState, FormData>(grantAccess, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="course_id" value={courseId} />
      <div>
        <label className="label" htmlFor="grant-email">
          E-mail do aluno
        </label>
        <input id="grant-email" name="email" type="email" required className="input" placeholder="aluno@email.com" />
      </div>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? <p className="text-sm text-accent">{state.message}</p> : null}
      <button type="submit" className="btn btn-secondary w-full" disabled={pending}>
        {pending ? "Liberando…" : "Liberar acesso"}
      </button>
    </form>
  );
}
