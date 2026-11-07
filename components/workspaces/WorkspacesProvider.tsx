"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import WorkspaceFormModal from "@/components/workspaces/WorkspaceFormModal";
import { apiGet } from "@/lib/fetcher";
import { workspaceHref } from "@/lib/workspaces";
import type { Workspace, WorkspaceTree } from "@/lib/types";

type WorkspacesState = {
  workspaces: WorkspaceTree[];
  loading: boolean;
  error: string | null;
};

type WorkspacesContextValue = WorkspacesState & {
  /** Busca de novo os espaços. Chame depois de criar, renomear ou excluir algo. */
  reload: () => Promise<void>;
  /** Abre o modal de novo espaço; ao criar, vai para o dashboard dele. */
  openCreateWorkspace: () => void;
};

const WorkspacesContext = createContext<WorkspacesContextValue | null>(null);

async function fetchWorkspaces(): Promise<
  { data: WorkspaceTree[] } | { error: string }
> {
  try {
    return { data: await apiGet<WorkspaceTree[]>("/api/workspaces") };
  } catch (cause) {
    return {
      error:
        cause instanceof Error ? cause.message : "Erro ao carregar os espaços",
    };
  }
}

/** Guarda a árvore de espaços usada pelo menu e pelas páginas dos espaços. */
export function WorkspacesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<WorkspacesState>({
    workspaces: [],
    loading: true,
    error: null,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const lastRequest = useRef(0);

  const reload = useCallback(() => {
    const request = ++lastRequest.current;
    return fetchWorkspaces().then((result) => {
      // Ignora respostas antigas quando duas recargas se cruzam.
      if (request !== lastRequest.current) return;
      setState((current) =>
        "data" in result
          ? { workspaces: result.data, loading: false, error: null }
          : { ...current, loading: false, error: result.error }
      );
    });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreateWorkspace = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const handleCreated = useCallback(
    async (workspace: Workspace) => {
      await reload();
      router.push(workspaceHref(workspace.id));
    },
    [reload, router]
  );

  const value = useMemo(
    () => ({ ...state, reload, openCreateWorkspace }),
    [state, reload, openCreateWorkspace]
  );

  return (
    <WorkspacesContext.Provider value={value}>
      {children}
      {/* Fica fora do menu lateral para abrir por cima de toda a página. */}
      <WorkspaceFormModal
        open={createOpen}
        onClose={closeCreate}
        onSaved={handleCreated}
      />
    </WorkspacesContext.Provider>
  );
}

export function useWorkspaces() {
  const value = useContext(WorkspacesContext);
  if (!value) {
    throw new Error("useWorkspaces precisa estar dentro de WorkspacesProvider");
  }
  return value;
}
