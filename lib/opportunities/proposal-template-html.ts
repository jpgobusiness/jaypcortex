/** HTML base da proposta. Espelho de templates/propostas/padrao.html. */
export const PADRAO_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{titulo}}</title>
  <style>
    :root { color-scheme: light; --ink: #142033; --muted: #5b6575; --line: #d9dee8; --brand: #1f4e79; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.55 "Source Sans 3", "Segoe UI", sans-serif; color: var(--ink); background: #eef1f6; }
    .page { max-width: 880px; margin: 32px auto; background: #fff; padding: 48px 56px 40px; box-shadow: 0 10px 40px #14203314; }
    h1 { font-size: 28px; color: var(--brand); margin: 0 0 8px; letter-spacing: -0.02em; }
    .meta { color: var(--muted); font-size: 14px; margin: 0 0 32px; }
    h2 { font-size: 18px; color: var(--brand); border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 28px 0 12px; }
    section p { margin: 0 0 10px; }
    .placeholder { color: #9aa3b2; font-style: italic; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 8px 0 16px; }
    th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f5f7fb; }
    ul, ol { margin: 0 0 12px; padding-left: 1.2em; }
    footer { margin-top: 40px; font-size: 12px; color: var(--muted); }
    @media print { body { background: #fff; } .page { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <article class="page">
    <header>
      <h1>{{titulo}}</h1>
      <p class="meta">{{cliente}} · {{data}}</p>
    </header>
    <section data-section="Resumo executivo">
      <h2>Resumo executivo</h2>
      {{Resumo executivo}}
    </section>
    <section data-section="Contexto do cliente">
      <h2>Contexto do cliente</h2>
      {{Contexto do cliente}}
    </section>
    <section data-section="Objetivos">
      <h2>Objetivos</h2>
      {{Objetivos}}
    </section>
    <section data-section="Escopo">
      <h2>Escopo</h2>
      {{Escopo}}
    </section>
    <section data-section="Fora de escopo">
      <h2>Fora de escopo</h2>
      {{Fora de escopo}}
    </section>
    <section data-section="Arquitetura proposta">
      <h2>Arquitetura proposta</h2>
      {{Arquitetura proposta}}
    </section>
    <section data-section="Plano de execução / fases">
      <h2>Plano de execução / fases</h2>
      {{Plano de execução / fases}}
    </section>
    <section data-section="Premissas">
      <h2>Premissas</h2>
      {{Premissas}}
    </section>
    <section data-section="Riscos">
      <h2>Riscos</h2>
      {{Riscos}}
    </section>
    <section data-section="Investimento">
      <h2>Investimento</h2>
      {{Investimento}}
    </section>
    <section data-section="Próximos passos">
      <h2>Próximos passos</h2>
      {{Próximos passos}}
    </section>
    <footer>Documento gerado a partir do Proposal Doc · Nuage / JayP</footer>
  </article>
</body>
</html>
`;
