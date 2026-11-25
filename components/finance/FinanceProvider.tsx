"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AccountModal from "@/components/finance/AccountModal";
import CardModal from "@/components/finance/CardModal";
import CategoryManager from "@/components/finance/CategoryManager";
import EntryModal, { type EntryPrefill } from "@/components/finance/EntryModal";
import TransactionEditModal from "@/components/finance/TransactionEditModal";
import { apiGet } from "@/lib/fetcher";
import { todayYmd } from "@/lib/finance/dates";
import type { FinAccount, FinBootstrap, FinCard, FinCategory, FinTransaction } from "@/lib/finance/types";

type Saved = (id: string) => void;

type FinanceContext = {
  today: string;
  accounts: FinAccount[];
  cards: FinCard[];
  categories: FinCategory[];
  ready: boolean;
  error: string | null;
  /** Sobe a cada mudança: as telas usam para recarregar. */
  version: number;
  refresh: () => Promise<void>;
  account: (id: string | null | undefined) => FinAccount | undefined;
  card: (id: string | null | undefined) => FinCard | undefined;
  category: (id: string | null | undefined) => FinCategory | undefined;
  openEntry: (prefill?: EntryPrefill) => void;
  editTransaction: (transaction: FinTransaction) => void;
  openAccount: (account?: FinAccount | null, onSaved?: Saved) => void;
  openCard: (card?: FinCard | null, onSaved?: Saved) => void;
  openCategories: () => void;
};

const Context = createContext<FinanceContext | null>(null);

export function useFinance() {
  const value = useContext(Context);
  if (!value) throw new Error("useFinance precisa do FinanceProvider");
  return value;
}

export default function FinanceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FinBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [entry, setEntry] = useState<{ prefill: EntryPrefill; key: number } | null>(null);
  const [editing, setEditing] = useState<FinTransaction | null>(null);
  const [accountForm, setAccountForm] = useState<{ account: FinAccount | null; onSaved?: Saved } | null>(null);
  const [cardForm, setCardForm] = useState<{ card: FinCard | null; onSaved?: Saved } | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const load = useCallback(
    () =>
      apiGet<FinBootstrap>("/api/financas/bootstrap").then(
        (next) => {
          setData(next);
          setError(null);
        },
        (cause: unknown) => setError(cause instanceof Error ? cause.message : "Erro ao carregar as finanças")
      ),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
    setVersion((value) => value + 1);
  }, [load]);

  const value = useMemo<FinanceContext>(() => {
    const accounts = data?.accounts ?? [];
    const cards = data?.cards ?? [];
    const categories = data?.categories ?? [];
    const byId = <T extends { id: string }>(list: T[]) => {
      const map = new Map(list.map((item) => [item.id, item]));
      return (id: string | null | undefined) => (id ? map.get(id) : undefined);
    };
    return {
      today: data?.today ?? todayYmd(),
      accounts,
      cards,
      categories,
      ready: data !== null,
      error,
      version,
      refresh,
      account: byId(accounts),
      card: byId(cards),
      category: byId(categories),
      openEntry: (prefill = {}) => setEntry({ prefill, key: Date.now() }),
      editTransaction: setEditing,
      openAccount: (account = null, onSaved) => setAccountForm({ account, onSaved }),
      openCard: (card = null, onSaved) => setCardForm({ card, onSaved }),
      openCategories: () => setCategoriesOpen(true),
    };
  }, [data, error, version, refresh]);

  return (
    <Context.Provider value={value}>
      {children}
      {entry && <EntryModal key={entry.key} prefill={entry.prefill} onClose={() => setEntry(null)} />}
      {editing && <TransactionEditModal key={editing.id} transaction={editing} onClose={() => setEditing(null)} />}
      {accountForm && (
        <AccountModal
          account={accountForm.account}
          onClose={() => setAccountForm(null)}
          onSaved={(id) => {
            accountForm.onSaved?.(id);
            setAccountForm(null);
          }}
        />
      )}
      {cardForm && (
        <CardModal
          card={cardForm.card}
          onClose={() => setCardForm(null)}
          onSaved={(id) => {
            cardForm.onSaved?.(id);
            setCardForm(null);
          }}
        />
      )}
      {categoriesOpen && <CategoryManager onClose={() => setCategoriesOpen(false)} />}
    </Context.Provider>
  );
}
