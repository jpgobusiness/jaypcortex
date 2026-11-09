# Templates HTML de proposta

O agente de código (Kiro/Cursor) monta a entrega a partir do **Proposal Doc** (TipTap no espaço Oportunidades) e deste HTML.

Fluxo: `read_document` do Proposal Doc → `get_proposal_template` → gerar HTML → `register_delivery`.

## Placeholders

Cada H2 do Proposal Doc vira um bloco `<section data-section="…">` no HTML. Substitua `{{Heading}}` pelo conteúdo daquela seção (já em HTML: parágrafos, listas, tabelas). Não deixe o `{{…}}` no arquivo final.

| H2 no Proposal Doc | Placeholder | Seletor |
|---|---|---|
| Resumo executivo | `{{Resumo executivo}}` | `[data-section="Resumo executivo"]` |
| Contexto do cliente | `{{Contexto do cliente}}` | `[data-section="Contexto do cliente"]` |
| Objetivos | `{{Objetivos}}` | `[data-section="Objetivos"]` |
| Escopo | `{{Escopo}}` | `[data-section="Escopo"]` |
| Fora de escopo | `{{Fora de escopo}}` | `[data-section="Fora de escopo"]` |
| Arquitetura proposta | `{{Arquitetura proposta}}` | `[data-section="Arquitetura proposta"]` |
| Plano de execução / fases | `{{Plano de execução / fases}}` | `[data-section="Plano de execução / fases"]` |
| Premissas | `{{Premissas}}` | `[data-section="Premissas"]` |
| Riscos | `{{Riscos}}` | `[data-section="Riscos"]` |
| Investimento | `{{Investimento}}` | `[data-section="Investimento"]` |
| Próximos passos | `{{Próximos passos}}` | `[data-section="Próximos passos"]` |

Extras no cabeçalho:

- `{{titulo}}` — título da proposta (ex. `[TAMURA] Proposal`)
- `{{cliente}}` — nome do cliente
- `{{data}}` — data da entrega

## Arquivos

- `padrao.html` — template padrão (o mesmo devolvido por `get_proposal_template` sem `name`).

Números, prazos e funding não inventados: usar `[A CONFIRMAR]` se a seção estiver vazia.
