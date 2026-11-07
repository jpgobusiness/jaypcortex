"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloud, X, FileText, Download, Trash2, ImageIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Label, Textarea, FormRow } from "@/components/ui/form";
import { apiPost, apiPatch, apiDelete } from "@/lib/fetcher";
import { toDateInput } from "@/lib/format";
import { monthFirstDay } from "@/lib/monthkey";
import type { OvertimeAttachment, OvertimeEntry } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  monthKey: string;
  entry?: OvertimeEntry | null;
};

type Pending = { file: File; url: string | null };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OvertimeEntryModal({
  open,
  onClose,
  onSaved,
  monthKey,
  entry,
}: Props) {
  const isEdit = Boolean(entry);
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [clickupRequested, setClickupRequested] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [existing, setExisting] = useState<OvertimeAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPending([]);
    if (entry) {
      setDate(toDateInput(entry.date));
      setHours(entry.hours ? String(entry.hours) : "");
      setDescription(entry.description ?? "");
      setClickupRequested(Boolean(entry.clickupRequested));
      setExisting(entry.attachments ?? []);
    } else {
      setDate(monthFirstDay(monthKey));
      setHours("");
      setDescription("");
      setClickupRequested(false);
      setExisting([]);
    }
  }, [open, entry, monthKey]);

  // Limpa object URLs ao desmontar/fechar.
  useEffect(() => {
    return () => {
      pending.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).map((file) => ({
      file,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setPending((prev) => [...prev, ...arr]);
  }

  function removePending(i: number) {
    setPending((prev) => {
      const p = prev[i];
      if (p?.url) URL.revokeObjectURL(p.url);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function deleteExisting(att: OvertimeAttachment) {
    if (!confirm(`Excluir o anexo "${att.name}"?`)) return;
    await apiDelete(`/api/overtime/attachments/${att.id}`);
    setExisting((prev) => prev.filter((a) => a.id !== att.id));
    onSaved();
  }

  async function uploadPending(entryId: string) {
    if (pending.length === 0) return;
    const fd = new FormData();
    pending.forEach((p) => fd.append("file", p.file));
    await fetch(`/api/overtime/entries/${entryId}/attachments`, {
      method: "POST",
      body: fd,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(hours);
    if (!hours || Number.isNaN(h) || h <= 0) {
      setError("Informe a quantidade de horas (maior que zero).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        monthKey,
        date: date || null,
        hours: h,
        description: description || null,
        clickupRequested,
      };
      if (isEdit && entry) {
        await apiPatch(`/api/overtime/entries/${entry.id}`, payload);
        await uploadPending(entry.id);
      } else {
        const created = await apiPost<{ id: string }>(
          "/api/overtime/entries",
          payload
        );
        await uploadPending(created.id);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar hora extra" : "Nova hora extra"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" form="overtime-form" disabled={saving}>
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Registrar"}
          </Button>
        </>
      }
    >
      <form id="overtime-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <FormRow>
          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="hours">Horas *</Label>
            <Input
              id="hours"
              type="number"
              min="0"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Ex.: 2.5"
              autoFocus
            />
          </div>
        </FormRow>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que foi feito nessas horas extras?"
          />
        </div>

        {/* Dropzone */}
        <div>
          <Label>Anexos (arquivos e imagens)</Label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging
                ? "border-[var(--brand)] bg-[var(--brand)]/[0.06]"
                : "border-[var(--border)] hover:border-[var(--brand)]/60"
            }`}
          >
            <UploadCloud className="h-6 w-6 text-[var(--muted)]" />
            <p className="text-sm text-[var(--foreground)]">
              Arraste arquivos aqui ou{" "}
              <span className="font-medium text-[var(--brand-600)]">
                clique para selecionar
              </span>
            </p>
            <p className="text-[11px] text-[var(--muted)]">
              Imagens, PDFs e documentos
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* Anexos existentes (editar) */}
          {existing.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-[var(--muted)]">
                Anexados
              </p>
              {existing.map((att) => (
                <AttachmentRow
                  key={att.id}
                  name={att.name}
                  size={att.size}
                  isImage={att.mimeType.startsWith("image/")}
                  previewUrl={`/api/overtime/attachments/${att.id}`}
                  downloadUrl={`/api/overtime/attachments/${att.id}?download=1`}
                  onRemove={() => deleteExisting(att)}
                />
              ))}
            </div>
          )}

          {/* Arquivos pendentes (a enviar) */}
          {pending.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-[var(--muted)]">
                A enviar ao salvar
              </p>
              {pending.map((p, i) => (
                <AttachmentRow
                  key={i}
                  name={p.file.name}
                  size={p.file.size}
                  isImage={Boolean(p.url)}
                  previewUrl={p.url ?? undefined}
                  onRemove={() => removePending(i)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Depois dos anexos, para não sumir quando a lista cresce */}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
          <input
            type="checkbox"
            checked={clickupRequested}
            onChange={(e) => setClickupRequested(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          <span className="text-sm text-[var(--foreground)]">
            Validado e solicitado no ClickUp
          </span>
        </label>
      </form>
    </Modal>
  );
}

function AttachmentRow({
  name,
  size,
  isImage,
  previewUrl,
  downloadUrl,
  onRemove,
}: {
  name: string;
  size: number;
  isImage: boolean;
  previewUrl?: string;
  downloadUrl?: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/[0.04]">
        {isImage && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={name} className="h-full w-full object-cover" />
        ) : isImage ? (
          <ImageIcon className="h-5 w-5 text-[var(--muted)]" />
        ) : (
          <FileText className="h-5 w-5 text-[var(--muted)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--foreground)]">{name}</p>
        <p className="text-[11px] text-[var(--muted)]">{formatBytes(size)}</p>
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/[0.05] hover:text-[var(--foreground)]"
          title="Baixar"
        >
          <Download className="h-4 w-4" />
        </a>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
        title="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
