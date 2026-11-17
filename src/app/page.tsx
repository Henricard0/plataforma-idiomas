import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { ChatIcon, FileIcon, GlobeIcon, PlayIcon, RadioIcon, VideoIcon } from "@/components/icons";

const features = [
  {
    icon: VideoIcon,
    title: "Aulas ao vivo",
    text: "Videochamada direto na plataforma, com compartilhamento de tela. Sem link de outro app.",
  },
  {
    icon: FileIcon,
    title: "Materiais da aula",
    text: "Apostilas, áudios e exercícios organizados por turma, sempre à mão.",
  },
  {
    icon: PlayIcon,
    title: "Cursos gravados",
    text: "Episódios novos toda semana para estudar além das aulas, no seu ritmo.",
  },
  {
    icon: RadioIcon,
    title: "Lives",
    text: "Aulões abertos, tira-dúvidas e pronúncia ao vivo, com chat para perguntar.",
  },
  {
    icon: ChatIcon,
    title: "Chat com o professor",
    text: "Tire dúvidas entre uma aula e outra e pratique em grupos de conversação.",
  },
  {
    icon: GlobeIcon,
    title: "Comunidades",
    text: "Um espaço por idioma para escrever, conversar e praticar com outros alunos.",
  },
];

const sampleEpisodes = [
  { n: 12, title: "Phrasal verbs do dia a dia", when: "Nova esta semana" },
  { n: 11, title: "Como pedir comida no restaurante", when: "Semana passada" },
  { n: 10, title: "Small talk sem travar", when: "Há 2 semanas" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        <span className="font-display text-xl font-semibold">{APP_NAME}</span>
        <nav className="flex items-center gap-2">
          <Link href="/entrar" className="btn btn-ghost">
            Entrar
          </Link>
          <Link href="/cadastro" className="btn btn-primary">
            Criar conta
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <p className="mb-4 text-sm font-medium text-accent">Inglês, espanhol e mais</p>
            <h1 className="font-display text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
              Aulas com professor de verdade. E estudo que continua entre uma aula e outra.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Suas aulas ao vivo, os materiais, cursos gravados com episódios semanais, lives e uma comunidade para
              praticar. Tudo num lugar só.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/cadastro" className="btn btn-primary h-11 px-5">
                Começar agora
              </Link>
              <Link href="/entrar" className="btn btn-secondary h-11 px-5">
                Já sou aluno
              </Link>
            </div>
          </div>

          <div className="card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Curso gravado</p>
                <p className="font-display text-lg font-semibold">Inglês para o dia a dia</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                Episódio novo toda segunda
              </span>
            </div>
            <ol className="divide-y divide-line rounded-lg border border-line">
              {sampleEpisodes.map((e) => (
                <li key={e.n} className="flex items-center gap-3 px-3 py-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-paper text-xs font-semibold text-muted">
                    {e.n}
                  </span>
                  <span className="flex-1 text-sm font-medium">{e.title}</span>
                  <span className="text-xs text-muted">{e.when}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-accent-soft px-4 py-3">
              <span className="text-sm text-accent">
                <span className="font-semibold">Ao vivo hoje, 19h:</span> conversação B1
              </span>
              <VideoIcon size={18} className="text-accent" />
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Tudo o que você precisa para aprender</h2>
            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon size={20} />
                  </span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <div className="card flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold">Já faz aula com a gente?</h2>
              <p className="mt-1.5 max-w-lg text-muted">
                Crie sua conta com o mesmo e-mail que você passou para o seu professor. Ele adiciona você às turmas.
              </p>
            </div>
            <Link href="/cadastro" className="btn btn-primary h-11 px-5">
              Criar minha conta
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-8">{APP_NAME}</div>
      </footer>
    </div>
  );
}
