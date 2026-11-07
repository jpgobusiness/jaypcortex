"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  CalendarCheck,
  ChevronDown,
  Flame,
  Bot,
  Home,
  Layers,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Timer,
  User,
  Waypoints,
  Zap,
  LogOut,
} from "lucide-react";
import SidebarWorkspaces from "@/components/workspaces/SidebarWorkspaces";

const ICON = "h-[18px] w-[18px] shrink-0";

const ACTIVITY_SECTIONS = [
  {
    href: "/atividades",
    secao: "lista",
    label: "Atividades",
    icon: ListTodo,
  },
  {
    href: "/atividades?secao=mapa",
    secao: "mapa",
    label: "Mapa mental",
    icon: Waypoints,
  },
];

const PESSOAL = [
  { href: "/controle-diario", label: "Controle Diário", icon: CalendarCheck },
  { href: "/desafio", label: "Desafio", icon: Flame },
];

const PROFISSIONAL = [
  { href: "/horas-extras", label: "Horas Extras", icon: Timer },
  { href: "/automacoes", label: "Automações", icon: Zap },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/usuarios", label: "Usuários", icon: User },
];

const SEARCH_DESTINATIONS = [
  { href: "/atividades", label: "Início", icon: Home },
  ...PESSOAL,
  { href: "/atividades", label: "Atividades", icon: ListTodo },
  ...ACTIVITY_SECTIONS.map(({ href, label, icon }) => ({ href, label, icon })),
  ...PROFISSIONAL,
  { href: "/escritorio", label: "Escritório de agentes", icon: Bot },
  { href: "/espacos", label: "Espaços de Trabalho", icon: Layers },
];

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

type Props = {
  embedded?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
};

function rowClass(active: boolean) {
  return `flex h-10 w-full items-center text-[13px] font-normal transition-colors ${
    active
      ? "bg-[var(--sidebar-active)] text-white"
      : "text-white/90 hover:bg-[var(--sidebar-hover)] hover:text-white"
  }`;
}

function itemClass(active: boolean, collapsed: boolean) {
  return `${rowClass(active)} ${collapsed ? "justify-center px-0" : "gap-3 px-4"}`;
}

function SidebarGlow() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute -bottom-10 -left-12 h-52 w-52 rounded-full bg-white/25 blur-3xl" />
      <div className="absolute -bottom-4 right-[-24px] h-40 w-40 rounded-full bg-white/30 blur-2xl" />
      <div className="absolute bottom-28 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-white/15 blur-xl" />
      <div className="absolute bottom-16 left-5 h-20 w-20 rounded-full border border-white/30" />
      <div className="absolute bottom-10 right-4 h-12 w-12 rounded-full border border-white/25" />
      <span className="absolute bottom-32 left-7 h-1.5 w-1.5 rounded-full bg-white/80" />
      <span className="absolute bottom-24 left-16 h-1 w-1 rounded-full bg-white/55" />
      <span className="absolute bottom-36 right-7 h-2 w-2 rounded-full bg-white/70" />
      <span className="absolute bottom-20 right-12 h-1 w-1 rounded-full bg-white/50" />
      <span className="absolute bottom-[5.5rem] left-[4.75rem] h-1 w-1 rounded-full bg-white/60" />
    </div>
  );
}

export default function Sidebar({
  embedded = false,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onActivities = pathname.startsWith("/atividades");
  const secao = searchParams.get("secao") === "mapa" ? "mapa" : "lista";

  const pessoalActive = PESSOAL.some((item) => pathname.startsWith(item.href));
  const profissionalActive =
    onActivities ||
    PROFISSIONAL.some((item) => pathname.startsWith(item.href));

  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState({
    pessoal: false,
    profissional: false,
  });
  const [activitiesOpen, setActivitiesOpen] = useState(false);

  useEffect(() => {
    if (onActivities) setActivitiesOpen(true);
    if (pessoalActive) {
      setOpenSections((current) => ({ ...current, pessoal: true }));
    }
    if (profissionalActive) {
      setOpenSections((current) => ({ ...current, profissional: true }));
    }
  }, [onActivities, pessoalActive, profissionalActive]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return [];
    return SEARCH_DESTINATIONS.filter((item) =>
      item.label.toLowerCase().includes(value)
    );
  }, [query]);

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <aside
      className={`relative flex h-full flex-col overflow-hidden text-white transition-[width] duration-200 ${
        embedded ? "w-full" : collapsed ? "w-16 shrink-0" : "w-60 shrink-0"
      }`}
      style={{ background: "var(--sidebar-gradient)" }}
    >
      <SidebarGlow />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <BrandLogo
        collapsed={collapsed && !embedded}
        onNavigate={onNavigate}
      />
      <SearchHome
        collapsed={collapsed && !embedded}
        query={query}
        onQuery={setQuery}
        onNavigate={onNavigate}
      />

      <nav className="flex-1 overflow-y-auto py-1">
        {query.trim() ? (
          <div>
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-[13px] text-white/70">
                Nenhum resultado
              </p>
            ) : (
              filtered.map((item) => {
                const [path, search] = item.href.split("?");
                const wanted = search
                  ? new URLSearchParams(search).get("secao")
                  : null;
                const active = wanted
                  ? onActivities && secao === wanted
                  : pathname === path || pathname.startsWith(`${path}/`);
                return (
                  <NavLink
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={active}
                    collapsed={collapsed && !embedded}
                    onNavigate={() => {
                      setQuery("");
                      onNavigate?.();
                    }}
                  />
                );
              })
            )}
          </div>
        ) : (
          <>
            <NavSection
              collapsed={collapsed && !embedded}
              icon={User}
              label="Pessoal"
              hasChildren
              open={openSections.pessoal}
              active={pessoalActive}
              onToggle={() => toggleSection("pessoal")}
            >
              {PESSOAL.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname.startsWith(item.href)}
                  collapsed={collapsed && !embedded}
                  onNavigate={onNavigate}
                />
              ))}
            </NavSection>

            <Divider />

            <NavSection
              collapsed={collapsed && !embedded}
              icon={Briefcase}
              label="Profissional"
              hasChildren
              open={openSections.profissional}
              active={profissionalActive}
              onToggle={() => toggleSection("profissional")}
            >
              <ExpandableLink
                href="/atividades"
                label="Atividades"
                icon={ListTodo}
                active={onActivities}
                collapsed={collapsed && !embedded}
                open={activitiesOpen}
                onToggle={() => setActivitiesOpen((value) => !value)}
                onNavigate={onNavigate}
              >
                {ACTIVITY_SECTIONS.map(({ href, secao: key, label, icon: Icon }) => (
                  <NavLink
                    key={key}
                    href={href}
                    label={label}
                    icon={Icon}
                    active={onActivities && secao === key}
                    collapsed={collapsed && !embedded}
                    onNavigate={onNavigate}
                  />
                ))}
              </ExpandableLink>
              {PROFISSIONAL.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname.startsWith(item.href)}
                  collapsed={collapsed && !embedded}
                  onNavigate={onNavigate}
                />
              ))}
            </NavSection>

            <Divider />

            <NavLink
              href="/escritorio"
              label="Escritório de agentes"
              icon={Bot}
              active={pathname.startsWith("/escritorio")}
              collapsed={collapsed && !embedded}
              onNavigate={onNavigate}
            />

            <Divider />

            <SidebarWorkspaces
              collapsed={collapsed && !embedded}
              onNavigate={onNavigate}
            />
          </>
        )}
      </nav>

      {!embedded && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={itemClass(false, collapsed)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <PanelLeftOpen className={ICON} strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className={ICON} strokeWidth={1.75} />
          )}
          {!collapsed && <span>Recolher</span>}
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
        className={itemClass(false, collapsed && !embedded)}
        aria-label="Sair"
        title="Sair"
      >
        <LogOut className={ICON} strokeWidth={1.75} />
        {!(collapsed && !embedded) && <span>Sair</span>}
      </button>
      </div>
    </aside>
  );
}

const LOGO_SRC = "/logo-jayp-cortex.png";

function BrandLogo({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  if (collapsed) {
    return (
      <div className="flex justify-center px-2 pt-3">
        <Link
          href="/atividades"
          onClick={onNavigate}
          title="JayP Cortex"
          className="flex h-[58px] w-[58px] items-center justify-center overflow-hidden"
        >
          <img
            src={LOGO_SRC}
            alt="JayP Cortex"
            className="h-[58px] w-[103px] max-w-none object-cover object-left"
          />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-6 pt-3">
      <Link
        href="/atividades"
        onClick={onNavigate}
        aria-label="JayP Cortex"
        className="flex justify-center py-2"
      >
        <img
          src={LOGO_SRC}
          alt="JayP Cortex"
          className="block h-[70px] w-auto max-w-full object-contain"
        />
      </Link>
    </div>
  );
}

function SearchHome({
  collapsed,
  query,
  onQuery,
  onNavigate,
}: {
  collapsed: boolean;
  query: string;
  onQuery: (value: string) => void;
  onNavigate?: () => void;
}) {
  if (collapsed) {
    return (
      <div className="flex justify-center px-2 py-2">
        <Link
          href="/atividades"
          onClick={onNavigate}
          title="Início"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--sidebar)]"
        >
          <Home className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 pt-2">
      <label className="flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[var(--sidebar)]">
        <Link
          href="/atividades"
          onClick={onNavigate}
          aria-label="Início"
          className="text-[var(--sidebar)]"
        >
          <Home className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Início"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
        />
      </label>
    </div>
  );
}

function Divider() {
  return <div className="mx-4 my-2 h-px bg-[var(--sidebar-border)]" />;
}

function NavSection({
  label,
  icon: Icon,
  href,
  collapsed,
  open,
  active,
  hasChildren = false,
  onToggle,
  onNavigate,
  children,
}: {
  label: string;
  icon: IconType;
  href?: string;
  collapsed: boolean;
  open: boolean;
  active: boolean;
  hasChildren?: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  children?: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <div>
        {href ? (
          <NavLink
            href={href}
            label={label}
            icon={Icon}
            active={active}
            collapsed
            onNavigate={onNavigate}
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            title={label}
            className={itemClass(active, true)}
          >
            <Icon className={ICON} strokeWidth={1.75} />
          </button>
        )}
        {open && children}
      </div>
    );
  }

  const chevron = hasChildren ? (
    <ChevronDown
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
        open ? "" : "-rotate-90"
      }`}
      strokeWidth={1.75}
    />
  ) : null;

  if (!href) {
    return (
      <div>
        <button
          type="button"
          onClick={onToggle}
          className={`${rowClass(active)} gap-3 px-4`}
          aria-expanded={hasChildren ? open : undefined}
        >
          <Icon className={ICON} strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          {chevron}
        </button>
        {open && hasChildren && <div>{children}</div>}
      </div>
    );
  }

  return (
    <div>
      <div className={`${rowClass(active)} px-4`}>
        <Link
          href={href}
          onClick={onNavigate}
          className="flex h-10 min-w-0 flex-1 items-center gap-3"
        >
          <Icon className={ICON} strokeWidth={1.75} />
          <span className="truncate">{label}</span>
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-10 w-8 shrink-0 items-center justify-center text-white/80 hover:text-white"
            aria-label={open ? `Recolher ${label}` : `Expandir ${label}`}
          >
            {chevron}
          </button>
        )}
      </div>
      {open && hasChildren && <div>{children}</div>}
    </div>
  );
}

function ExpandableLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  open,
  onToggle,
  onNavigate,
  children,
}: {
  href: string;
  label: string;
  icon: IconType;
  active: boolean;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <div>
        <NavLink
          href={href}
          label={label}
          icon={Icon}
          active={active}
          collapsed
          onNavigate={onNavigate}
        />
        {open && children}
      </div>
    );
  }

  return (
    <div>
      <div className={`${rowClass(active)} px-4`}>
        <Link
          href={href}
          onClick={onNavigate}
          className="flex h-10 min-w-0 flex-1 items-center gap-3"
        >
          <Icon className={ICON} strokeWidth={1.75} />
          <span className="truncate">{label}</span>
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 w-8 shrink-0 items-center justify-center text-white/80 hover:text-white"
          aria-label={open ? `Recolher ${label}` : `Abrir ${label}`}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${
              open ? "" : "-rotate-90"
            }`}
            strokeWidth={1.75}
          />
        </button>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: IconType;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={itemClass(active, collapsed)}
    >
      <Icon className={ICON} strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
