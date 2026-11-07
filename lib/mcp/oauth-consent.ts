function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hidden(name: string, value: string): string {
  return `<input type="hidden" name="${esc(name)}" value="${esc(value)}" />`;
}

export function consentHtml(opts: {
  clientName: string;
  scopes: string[];
  fields: Record<string, string>;
  error?: string;
}): string {
  const scopes = opts.scopes.map((s) => `<li><code>${esc(s)}</code></li>`).join("");
  const fields = Object.entries(opts.fields)
    .filter(([, v]) => v)
    .map(([k, v]) => hidden(k, v))
    .join("\n");
  const error = opts.error
    ? `<p style="color:#b91c1c;font-size:14px" role="alert">${esc(opts.error)}</p>`
    : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autorizar Amazon Quick</title>
  <style>
    :root { --background:#f7f8fa; --surface:#fff; --foreground:#1a1c23; --muted:#6b7280; --border:#e8eaee; --brand:#7b68ee; --brand-600:#6c5ce7; }
    body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center; background:var(--background); font-family:ui-sans-serif,system-ui,sans-serif; color:var(--foreground); }
    .card { width:100%; max-width:28rem; margin:1rem; padding:1.5rem; border:1px solid var(--border); border-radius:1rem; background:var(--surface); box-shadow:0 1px 2px rgb(0 0 0 / 0.04); }
    h1 { margin:0 0 .25rem; font-size:1.125rem; text-align:center; }
    p { margin:.5rem 0; color:var(--muted); font-size:.875rem; text-align:center; }
    ul { margin:.75rem 0 1.25rem; padding-left:1.25rem; color:var(--foreground); font-size:.875rem; }
    .row { display:flex; gap:.75rem; }
    button { flex:1; height:2.75rem; border:0; border-radius:.5rem; font-size:.875rem; font-weight:500; cursor:pointer; }
    .ok { background:var(--brand); color:#fff; }
    .ok:hover { background:var(--brand-600); }
    .no { background:#fff; color:var(--foreground); border:1px solid var(--border); }
    img { display:block; margin:0 auto 1.25rem; height:3.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <img src="/logo-jayp-cortex.png" alt="JayP Cortex" />
    <h1>Autorizar Amazon Quick a acessar a JayP Cortex</h1>
    <p>O cliente <strong>${esc(opts.clientName)}</strong> pede acesso com os escopos:</p>
    <ul>${scopes}</ul>
    ${error}
    <form method="post" class="row">
      ${fields}
      <button class="no" type="submit" name="decision" value="deny">Negar</button>
      <button class="ok" type="submit" name="decision" value="authorize">Autorizar</button>
    </form>
  </div>
</body>
</html>`;
}

export function oauthErrorHtml(title: string, message: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><title>${esc(title)}</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:2rem;color:#1a1c23}</style>
</head><body><h1>${esc(title)}</h1><p>${esc(message)}</p></body></html>`;
}
