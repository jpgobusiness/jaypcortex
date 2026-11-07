"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    Boolean(window.navigator.standalone)
  );
}

export default function PwaProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* silencioso em dev/sem HTTPS */
      });
    }

    try {
      if (localStorage.getItem("nuage-pwa-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }

    if (isStandalone()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if (isIos()) {
      setShowIos(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    setDismissed(true);
    setDeferred(null);
    setShowIos(false);
    try {
      localStorage.setItem("nuage-pwa-dismissed", "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (dismissed || isStandalone()) return null;
  if (!deferred && !showIos) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-4 md:left-auto md:right-4 md:w-96">
      <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl animate-slide-up">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Instalar Nuage
          </p>
          {deferred ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Adicione à tela inicial para acesso rápido como app.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              No Safari: toque em{" "}
              <Share className="inline h-3 w-3" aria-hidden /> Compartilhar →
              &quot;Adicionar à Tela de Início&quot;.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {deferred && (
              <button
                type="button"
                onClick={install}
                className="inline-flex min-h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-medium text-white"
              >
                Instalar
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium text-[var(--muted)] hover:bg-black/[0.04]"
            >
              Agora não
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
