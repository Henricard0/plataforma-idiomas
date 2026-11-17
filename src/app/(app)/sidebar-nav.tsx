"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { APP_NAME } from "@/lib/config";
import { Avatar } from "@/components/ui";
import {
  ChatIcon,
  CloseIcon,
  FileIcon,
  GlobeIcon,
  HomeIcon,
  LayersIcon,
  LogoutIcon,
  MenuIcon,
  PanelLeftIcon,
  PlayIcon,
  RadioIcon,
  UsersIcon,
  VideoIcon,
} from "@/components/icons";
import { signOut } from "../(auth)/actions";

type Item = { href: string; label: string; icon: ComponentType<{ size?: number }> };

const mainItems: Item[] = [
  { href: "/painel", label: "Painel", icon: HomeIcon },
  { href: "/aulas", label: "Aulas ao vivo", icon: VideoIcon },
  { href: "/materiais", label: "Materiais", icon: FileIcon },
  { href: "/cursos", label: "Cursos gravados", icon: PlayIcon },
  { href: "/lives", label: "Lives", icon: RadioIcon },
  { href: "/mensagens", label: "Mensagens", icon: ChatIcon },
  { href: "/comunidades", label: "Comunidades", icon: GlobeIcon },
];

const teacherItems: Item[] = [
  { href: "/alunos", label: "Meus alunos", icon: UsersIcon },
  { href: "/estudio", label: "Estúdio de cursos", icon: LayersIcon },
];

/**
 * Menu lateral.
 * - Tablet e computador: barra lateral fixa, que pode ser recolhida só com ícones.
 * - Celular: barra no topo com botão ☰ que abre o menu por cima da página.
 */
export function SidebarNav({
  name,
  isTeacher,
  initialCollapsed,
}: {
  name: string;
  isTeacher: boolean;
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Menu do celular: fecha com Esc e trava a rolagem da página enquanto aberto.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  return (
    <>
      {/* Celular */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-2 md:hidden">
        <button
          type="button"
          className="btn btn-ghost size-10 px-0"
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <MenuIcon size={20} />
        </button>
        <Link href="/painel" className="flex-1 font-display text-lg font-semibold">
          {APP_NAME}
        </Link>
        <Avatar name={name} size={32} />
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="font-display text-lg font-semibold">{APP_NAME}</span>
              <button
                type="button"
                className="btn btn-ghost size-9 px-0"
                aria-label="Fechar menu"
                onClick={() => setDrawerOpen(false)}
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
              <NavList items={mainItems} isActive={isActive} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
              {isTeacher ? (
                <>
                  <SectionLabel collapsed={false} />
                  <NavList items={teacherItems} isActive={isActive} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
                </>
              ) : null}
            </nav>
            <UserFooter name={name} isTeacher={isTeacher} collapsed={false} />
          </div>
        </div>
      ) : null}

      {/* Tablet e computador */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        <div className={`flex h-16 items-center ${collapsed ? "justify-center" : "justify-between px-5"}`}>
          {collapsed ? null : (
            <Link href="/painel" className="truncate font-display text-xl font-semibold">
              {APP_NAME}
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="btn btn-ghost size-9 shrink-0 px-0 text-muted"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            <PanelLeftIcon size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-2" aria-label="Navegação principal">
          <NavList items={mainItems} isActive={isActive} collapsed={collapsed} />
          {isTeacher ? (
            <>
              <SectionLabel collapsed={collapsed} />
              <NavList items={teacherItems} isActive={isActive} collapsed={collapsed} />
            </>
          ) : null}
        </nav>
        <UserFooter name={name} isTeacher={isTeacher} collapsed={collapsed} />
      </aside>
    </>
  );
}

function SectionLabel({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <hr className="mx-2 my-4 border-line" />
  ) : (
    <p className="mt-6 mb-2 px-3 text-xs font-medium tracking-wide text-muted uppercase">Professor</p>
  );
}

function NavList({
  items,
  isActive,
  collapsed,
  onNavigate,
}: {
  items: Item[];
  isActive: (href: string) => boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`flex h-10 items-center gap-3 rounded-lg text-sm transition-colors ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${active ? "bg-accent-soft font-medium text-accent" : "text-ink/80 hover:bg-black/5 hover:text-ink"}`}
            >
              <Icon size={18} />
              <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserFooter({ name, isTeacher, collapsed }: { name: string; isTeacher: boolean; collapsed: boolean }) {
  return (
    <div
      className={`flex border-t border-line py-4 ${collapsed ? "flex-col items-center gap-2 px-2" : "items-center gap-3 px-4"}`}
    >
      <Avatar name={name} size={34} />
      {collapsed ? null : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs text-muted">{isTeacher ? "Professor(a)" : "Aluno(a)"}</p>
        </div>
      )}
      <form action={signOut}>
        <button type="submit" className="btn btn-ghost size-9 px-0" aria-label="Sair" title="Sair">
          <LogoutIcon size={16} />
        </button>
      </form>
    </div>
  );
}
