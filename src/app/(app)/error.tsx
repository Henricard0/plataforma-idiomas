"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card max-w-xl p-6">
      <h1 className="text-lg font-semibold">Algo não saiu como esperado</h1>
      <p className="mt-2 text-sm text-muted">
        {error.message && !error.digest ? error.message : "Não conseguimos concluir essa ação. Tente de novo."}
      </p>
      <button type="button" className="btn btn-secondary mt-4" onClick={reset}>
        Tentar de novo
      </button>
    </div>
  );
}
