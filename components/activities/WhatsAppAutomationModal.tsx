"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, MessageCircle, Search, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Label, Textarea } from "@/components/ui/form";
import { apiGet } from "@/lib/fetcher";
import type { Activity, AutomationContact } from "@/lib/types";
import { buildWhatsAppUrl, formatWhatsAppPhone } from "@/lib/whatsapp";

type Props = {
  open: boolean;
  activity: Activity | null;
  onClose: () => void;
};

export default function WhatsAppAutomationModal({
  open,
  activity,
  onClose,
}: Props) {
  const [contacts, setContacts] = useState<AutomationContact[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setSearch("");
    setSelectedId("");
    setError("");
    setLoading(true);
    apiGet<AutomationContact[]>("/api/automations/contacts")
      .then((items) => {
        setContacts(items);
        if (items.length === 1) setSelectedId(items[0].id);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os contatos"
        )
      )
      .finally(() => setLoading(false));
  }, [open, activity?.id]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return contacts;
    return contacts.filter(
      (contact) =>
        contact.name.toLocaleLowerCase("pt-BR").includes(term) ||
        contact.phone.includes(term.replace(/\D/g, ""))
    );
  }, [contacts, search]);

  function openWhatsApp() {
    const contact = contacts.find((item) => item.id === selectedId);
    if (!message.trim()) {
      setError("Escreva a mensagem que deseja enviar");
      return;
    }
    if (!contact) {
      setError("Selecione uma pessoa para receber a mensagem");
      return;
    }

    setError("");
    window.location.href = buildWhatsAppUrl(contact.phone, message);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar mensagem"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={openWhatsApp}
            disabled={!message.trim() || !selectedId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Abrir no WhatsApp
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {activity && (
          <div className="rounded-xl border border-[var(--border)] bg-black/[0.02] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Atividade
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
              {activity.title}
            </p>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">
              1
            </span>
            <Label htmlFor="automation-message">Redija a mensagem</Label>
          </div>
          <Textarea
            id="automation-message"
            autoFocus
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Digite exatamente a mensagem que deverá aparecer no WhatsApp..."
            className="min-h-36"
          />
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            O texto será transferido integralmente para o campo da conversa.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">
                2
              </span>
              <span className="text-xs font-medium text-[var(--muted)]">
                Selecione o contato
              </span>
            </div>
            <Link
              href="/automacoes"
              onClick={onClose}
              className="text-xs font-semibold text-[var(--brand)] hover:underline"
            >
              Gerenciar contatos
            </Link>
          </div>

          {contacts.length > 4 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar contato..."
                className="pl-9"
              />
            </div>
          )}

          <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {loading ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--muted)]">
                Carregando contatos...
              </p>
            ) : contacts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center">
                <Users className="mx-auto h-6 w-6 text-[var(--muted)]" />
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                  Nenhum contato cadastrado
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Cadastre uma pessoa na área de Automações para continuar.
                </p>
                <Link
                  href="/automacoes"
                  onClick={onClose}
                  className="mt-3 inline-flex rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white"
                >
                  Cadastrar contato
                </Link>
              </div>
            ) : filteredContacts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--muted)]">
                Nenhum contato encontrado.
              </p>
            ) : (
              filteredContacts.map((contact) => {
                const checked = selectedId === contact.id;
                return (
                  <label
                    key={contact.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-[var(--border)] hover:bg-black/[0.02]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="automation-contact"
                      value={contact.id}
                      checked={checked}
                      onChange={() => {
                        setSelectedId(contact.id);
                        setError("");
                      }}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {contact.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                        {contact.name}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {formatWhatsAppPhone(contact.phone)}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
