"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ListTodo,
  Settings,
  Flame,
  CalendarCheck,
  Layers,
} from "lucide-react";

const NAV = [
  { href: "/atividades", label: "Atividades", icon: ListTodo },
  { href: "/controle-diario", label: "Diário", icon: CalendarCheck },
  { href: "/espacos", label: "Espaços", icon: Layers },
  { href: "/desafio", label: "Desafio", icon: Flame },
  { href: "/configuracoes", label: "Config", icon: Settings },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <ul className="grid h-16 grid-cols-5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-[var(--brand-600)]"
                    : "text-[var(--muted)]"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "stroke-[2.25]" : ""}`}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
