"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button, Input, Label } from "@/components/ui/form";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import type { AutomationContact } from "@/lib/types";
import { formatWhatsAppPhone } from "@/lib/whatsapp";

export default function AutomacoesPage() {
  const [contacts, setContacts] = useState<AutomationContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(
        await apiGet<AutomationContact[]>("/api/automations/contacts")
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível carregar"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  async function addContact() {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError("");
    try {
      await apiPost("/api/automations/contacts", { name, phone });
      setName("");
      setPhone("");
      await loadContacts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Automações"
        subtitle="Gerencie ações rápidas e os dados usados por cada fluxo."
      />

      <div className="space-y-6 p-4 sm:p-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Suas automações
          </h2>
          <button
            type="button"
            onClick={() => setSelected((current) => !current)}
            className={`flex w-full max-w-xl items-center gap-4 rounded-2xl border bg-[var(--surface)] p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
              selected
                ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15"
                : "border-[var(--border)]"
            }`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <MessageCircle className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-[var(--foreground)]">
                  Enviar mensagem
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  Ativa
                </span>
              </span>
              <span className="mt-1 block text-sm text-[var(--muted)]">
                Redija uma mensagem em uma atividade e abra a conversa certa
                no WhatsApp.
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
              <Users className="h-4 w-4" />
              {contacts.length}
            </span>
          </button>
        </section>

        {selected && (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-start gap-3 border-b border-[var(--border)] p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]">
                <Zap className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">
                  Enviar mensagem pelo WhatsApp
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Cadastre as pessoas que poderão ser selecionadas no botão de
                  automação dos cards.
                </p>
              </div>
            </div>

            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(340px,1.2fr)]">
              <div className="rounded-xl border border-[var(--border)] bg-black/[0.015] p-4">
                <h3 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                  Novo contato
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="automation-contact-name">Nome</Label>
                    <Input
                      id="automation-contact-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ex.: João da Silva"
                    />
                  </div>
                  <div>
                    <Label htmlFor="automation-contact-phone">WhatsApp</Label>
                    <Input
                      id="automation-contact-phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Ex.: (11) 99999-9999"
                      inputMode="tel"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void addContact();
                      }}
                    />
                    <p className="mt-1.5 text-xs text-[var(--muted)]">
                      Números brasileiros recebem o código +55 automaticamente.
                    </p>
                  </div>
                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </p>
                  )}
                  <Button
                    onClick={() => void addContact()}
                    disabled={saving || !name.trim() || !phone.trim()}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4" />
                    {saving ? "Cadastrando..." : "Cadastrar contato"}
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    Contatos cadastrados
                  </h3>
                  <span className="text-xs text-[var(--muted)]">
                    {contacts.length} contato(s)
                  </span>
                </div>
                <div className="space-y-2">
                  {loading ? (
                    <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
                      Carregando contatos...
                    </p>
                  ) : contacts.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
                      Nenhum contato cadastrado ainda.
                    </p>
                  ) : (
                    contacts.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        onChange={loadContacts}
                        onError={setError}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ContactRow({
  contact,
  onChange,
  onError,
}: {
  contact: AutomationContact;
  onChange: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    onError("");
    try {
      await apiPatch(`/api/automations/contacts/${contact.id}`, {
        name,
        phone,
      });
      setEditing(false);
      await onChange();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Erro ao salvar contato");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Excluir o contato "${contact.name}"?`)) return;
    onError("");
    try {
      await apiDelete(`/api/automations/contacts/${contact.id}`);
      await onChange();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Erro ao excluir contato");
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-[var(--brand)] bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            value={phone}
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setName(contact.name);
              setPhone(contact.phone);
              setEditing(false);
            }}
          >
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            <Check className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
        {contact.name.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
          {contact.name}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {formatWhatsAppPhone(contact.phone)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--brand)]"
        aria-label={`Editar ${contact.name}`}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => void remove()}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
        aria-label={`Excluir ${contact.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
