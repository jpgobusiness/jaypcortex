"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { apiGet, apiPatch, apiPost } from "@/lib/fetcher";

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "member";
  active: boolean;
  created_at?: string;
};

export default function UsuariosClient({ email }: { email: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"member" | "admin">("member");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<UserRow[]>("/api/usuarios");
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/usuarios", {
        email: newEmail,
        password: newPassword,
        display_name: newName,
        role: newRole,
      });
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("member");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    try {
      await apiPatch(`/api/usuarios/${id}`, body);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle={`Logado como ${email}. Sem cadastro aberto: só o admin cria contas.`}
      />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-sm font-semibold">Novo usuário</h2>
          <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="u-name">Nome</Label>
              <Input
                id="u-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome de exibição"
              />
            </div>
            <div>
              <Label htmlFor="u-email">E-mail</Label>
              <Input
                id="u-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="u-pass">Senha inicial</Label>
              <Input
                id="u-pass"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="u-role">Papel</Label>
              <Select
                id="u-role"
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value === "admin" ? "admin" : "member")
                }
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Criando…" : "Criar usuário"}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-sm font-semibold">Contas</h2>
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Carregando…</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {user.display_name || user.email}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {user.email} · {user.role}
                      {user.active ? "" : " · desativado"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        patch(user.id, {
                          role: user.role === "admin" ? "member" : "admin",
                        })
                      }
                    >
                      Tornar {user.role === "admin" ? "member" : "admin"}
                    </Button>
                    <Button
                      type="button"
                      variant={user.active ? "danger" : "outline"}
                      onClick={() => patch(user.id, { active: !user.active })}
                    >
                      {user.active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
