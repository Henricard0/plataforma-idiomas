"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, type AuthState } from "./actions";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  const linkError = params.get("erro") === "link";

  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Acesse suas aulas, cursos e comunidades.</p>
      </div>
      {linkError && !state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
          O link de acesso expirou ou já foi usado. Entre com e-mail e senha.
        </p>
      ) : null}
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="next" value={params.get("next") ?? "/painel"} />
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-accent hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});

  if (state.message) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Confira seu e-mail</h1>
        <p className="text-sm text-muted">{state.message}</p>
        <Link href="/entrar" className="btn btn-secondary w-full">
          Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted">Leva menos de um minuto.</p>
      </div>
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <div>
        <label className="label" htmlFor="full_name">
          Nome completo
        </label>
        <input id="full_name" name="full_name" autoComplete="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="input"
        />
        <p className="hint">Mínimo de 8 caracteres.</p>
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </button>
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
