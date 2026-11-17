import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card max-w-xl p-6">
      <h1 className="text-lg font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted">Ela pode ter sido removida, ou você não tem acesso a ela.</p>
      <Link href="/painel" className="btn btn-secondary mt-4">
        Voltar ao painel
      </Link>
    </div>
  );
}
