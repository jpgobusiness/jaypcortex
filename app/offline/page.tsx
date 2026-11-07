export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand-600)] text-2xl font-bold">
        Nu
      </div>
      <h1 className="text-lg font-semibold text-[var(--foreground)]">
        Você está offline
      </h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        Sem conexão no momento. Reconecte-se para carregar dados atualizados.
        Páginas já visitadas podem continuar disponíveis.
      </p>
      <a
        href="/atividades"
        className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white"
      >
        Tentar novamente
      </a>
    </div>
  );
}
