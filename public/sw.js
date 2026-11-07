// Trocar a versão apaga o cache antigo (que tinha CSS e JS desatualizados).
const CACHE = "nuage-shell-v3";
const PRECACHE = ["/", "/atividades", "/escritorio", "/espacos", "/controle-diario", "/desafio", "/horas-extras", "/configuracoes", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cacheia API — dados dinâmicos
  if (url.pathname.startsWith("/api/")) return;

  // Navegação: network-first com fallback offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline");
        })
    );
    return;
  }

  // Demais arquivos (CSS, JS, imagens): network-first.
  // No `next dev` o nome do arquivo não muda quando o conteúdo muda, então
  // servir do cache primeiro mostrava estilos e scripts antigos.
  // O cache só é usado quando não há rede.
  event.respondWith(
    fetch(request)
      .then((res) => {
        // 200 apenas: respostas parciais (206) não podem ir para o cache.
        if (res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(request)) || Response.error())
  );
});
