"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { APP_NAME } from "@/lib/config";
import { Avatar } from "@/components/ui";
import {
  ChatIcon,
  FileIcon,
  GlobeIcon,
  HomeIcon,
  LayersIcon,
  LogoutIcon,
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

export function SidebarNav({ name, isTeacher }: { name: string; isTeacher: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const items = isTeacher ? [...mainItems, ...teacherItems] : mainItems;

  return (
    <>
      {/* Mobile: barra superior com navegação rolável */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/painel" className="font-display text-lg font-semibold">
            {APP_NAME}
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost btn-sm" aria-label="Sair">
              <LogoutIcon size={16} />
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Navegação principal">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                isActive(item.href) ? "bg-accent text-white" : "text-muted hover:bg-black/5"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Desktop: barra lateral */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link href="/painel" className="px-6 pt-6 pb-8 font-display text-xl font-semibold">
          {APP_NAME}
        </Link>
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Navegação principal">
          <NavList items={mainItems} isActive={isActive} />
          {isTeacher ? (
            <>
              <p className="mt-6 mb-2 px-3 text-xs font-medium tracking-wide text-muted uppercase">Professor</p>
              <NavList items={teacherItems} isActive={isActive} />
            </>
          ) : null}
        </nav>
        <div className="flex items-center gap-3 border-t border-line px-4 py-4">
          <Avatar name={name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs text-muted">{isTeacher ? "Professor(a)" : "Aluno(a)"}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost btn-sm px-2" aria-label="Sair" title="Sair">
              <LogoutIcon size={16} />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function NavList({ items, isActive }: { items: Item[]; isActive: (href: string) => boolean }) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                active ? "bg-accent-soft font-medium text-accent" : "text-ink/80 hover:bg-black/5 hover:text-ink"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
