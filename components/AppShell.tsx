"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { WorkspacesProvider } from "@/components/workspaces/WorkspacesProvider";

const SIDEBAR_KEY = "nuage-sidebar-collapsed";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const secao = useSearchParams().get("secao");
  const isLogin = pathname === "/login";

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Fecha o drawer ao navegar.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, secao]);

  // Trava scroll do body com drawer aberto.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <WorkspacesProvider>
      <div className="flex h-dvh overflow-hidden">
        {/* Sidebar desktop */}
        <div className="hidden md:flex md:h-full">
          <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
        </div>

        {/* Drawer mobile */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Fechar menu"
              className="absolute inset-0 bg-black/40 animate-fade-in"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] animate-slide-in-left flex-col text-[var(--sidebar-text)] shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
              style={{ background: "var(--sidebar-gradient)" }}
            >
              <div className="flex items-center justify-end px-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Sidebar embedded onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar mobile */}
          <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--foreground)] hover:bg-black/[0.05]"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center">
              <img
                src="/logo-jayp-cortex.png"
                alt="JayP Cortex"
                className="h-7 w-auto max-w-[11rem] object-contain object-left"
              />
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>

          <MobileBottomNav />
        </div>
      </div>
    </WorkspacesProvider>
  );
}
