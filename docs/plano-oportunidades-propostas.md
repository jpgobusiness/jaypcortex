# Plano — Espaço "Oportunidades" + coautoria de documentos via MCP

Status: **Fase A e Fase B feitas** (9 nov 2026). Fase C ainda não.
Dono: João Paulo. Implementação: Cursor. Cliente principal: Amazon Quick (conector `JayPCortexChat`).

## 1. Objetivo

Montar propostas conversando com o Quick, que lê e grava direto na plataforma:

1. João cria uma oportunidade (pasta) e coloca a transcrição da reunião.
2. O Quick lê a transcrição e o contexto e discute a arquitetura com o João.
3. O João pede um texto, aprova, e o Quick grava **só aquela seção** no Proposal Doc.
4. Esse ciclo se repete seção por seção, cada gravação com revisão (`FileRevision`).
5. No fim, o Quick entrega o doc ao Kiro/Cursor, que gera o HTML no template padrão e salva em `Entregas`.

## 2. Modelo de dados (sem tabela nova)

Reaproveita `Workspace → WorkspaceFolder (1 nível) → WorkspaceFile`.

```
Espaço: Oportunidades            (Workspace, slug/flag "opportunities")
├── Pasta: [CLIENTE] Nome da oportunidade   (1 pasta = 1 oportunidade)
│   ├── Contexto                 kind=contexto
│   ├── Transcrição 2026-11-09   kind=transcricao
│   ├── Proposal Doc             kind=proposal_doc
│   ├── Arquitetura              kind=arquitetura
│   └── Outros (notas, e-mails)  kind=outro
```

Mudanças:
- `WorkspaceFile.kind`: aceitar também `transcricao`, `proposal_doc`, `arquitetura`, `nota` (além dos atuais).
- `WorkspaceFolder.opportunityId String?` → FK opcional para `Opportunity` (liga a pasta ao funil). Índice.
- `Workspace.key String? @unique` (ex.: `opportunities`) para o MCP achar o espaço sem depender do nome.
- Migration Postgres + RLS igual às demais tabelas.

Seed: criar o espaço "Oportunidades" (`key=opportunities`) se não existir.

## 3. Templates

- Arquivo `kind=template` no espaço Oportunidades (pasta `_Templates`): **Proposal Doc padrão**, com estas seções H2:
  Resumo executivo · Contexto do cliente · Objetivos · Escopo · Fora de escopo · Arquitetura proposta · Plano de execução / fases · Premissas · Riscos · Investimento · Próximos passos.
- Template **Contexto da oportunidade**: Cliente · Contatos · Dor · Ambiente atual · Programa AWS (MAP/POC/etc.) · Status · Decisões.
- Templates HTML de proposta: caminho fixo no repo `templates/propostas/` (fora do banco). Documentar no `contexto-plataforma.md`.

## 4. UI

- Em `/espacos`, o espaço Oportunidades ganha o botão **"Nova oportunidade"**: cria a pasta e, a partir dos templates, os arquivos Contexto e Proposal Doc. Opcionalmente vincula a uma `Opportunity` existente.
- Badge do `kind` na lista de arquivos (Transcrição, Proposal Doc...).
- Transcrição: colar texto num arquivo novo `kind=transcricao` (dia 1). Upload de áudio fica para depois.
- O editor mostra "editado pelo Quick" (`updatedBy`/`source=mcp`) e o histórico de revisões, que já existe.

## 5. MCP — tools novas

Todas com `title` PT-BR, annotations, **schema só strings** (padrão Quick; números como string), escopo indicado.

| Tool | Escopo | O que faz |
|---|---|---|
| `list_opportunity_folders` | read | Lista as pastas do espaço Oportunidades com os arquivos (id, título, kind, updatedAt) |
| `create_opportunity_folder` | write | `name`, `opportunity_id?` → cria a pasta + Contexto + Proposal Doc a partir dos templates. Idempotente por nome |
| `create_file_in_folder` | write | `folder_id`, `title`, `kind`, `markdown?`, `template_id?` → cria o arquivo (template copiado em TipTap direto, sem markdown) |
| `get_document_outline` | read | `file_id` → seções `{section_id, heading, level, order, chars}` + `content_hash` |
| `read_section` | read | `file_id`, `section_id` ou `heading` → markdown da seção |
| `upsert_section` | write | `file_id`, `heading`, `markdown`, `after_heading?`, `expected_hash?` → substitui o corpo da seção (do H até o próximo H de mesmo nível ou superior) ou cria a seção. Converte **só o trecho** para TipTap |
| `append_to_document` | write | `file_id`, `markdown`, `expected_hash?` → adiciona no fim |
| `delete_section` | write | `file_id`, `heading`, `expected_hash?` |

Regras de implementação:
- Operar sobre o **JSON TipTap** (localizar nós heading e fatiar o array `content`), nunca reconverter o documento inteiro de markdown.
- `expected_hash` diferente do `contentHash` atual → erro `conflict` com o hash novo (não grava).
- Cada gravação: `FileRevision` + reindexação (FTS/embedding) + `excerpt` + `updatedBy` + `source=mcp` + `AuditLog`.
- Resposta curta: `{file_id, section_id, content_hash, revision_id, url}`.
- Lib compartilhada `lib/tiptap/sections.ts` (outline, fatiar, substituir) com testes unitários (tabela, lista, code block, seção inexistente, headings duplicados → usa o primeiro e avisa).
- Ajustar o `cortex`: pedidos com "proposta", "oportunidade", "transcrição" e "proposal doc" roteiam para um agente **Propostas** (slug `propostas`), com o prompt do fluxo do item 6 e suggested_tools = tools acima.
- Expor as rotas REST equivalentes para a UI (`/api/workspaces/files/[id]/sections`).

## 6. Agente "Propostas" (slug `propostas`)

Prompt (camada base):
- Sempre começar por `list_opportunity_folders`. Ler Contexto + transcrições antes de propor.
- Gerar o texto no chat; **gravar só depois do "ok" do João** via `upsert_section`.
- Uma seção por vez; usar `get_document_outline` antes de gravar; passar `expected_hash`.
- Não inventar números/valores: marcar `[A CONFIRMAR]`.
- Atualizar o arquivo Contexto quando surgir uma decisão nova.

## 7. Geração de HTML (fora da plataforma)

- O Quick lê o Proposal Doc (`read_document`) → delega ao Kiro/Cursor no Mac com o template em `templates/propostas/`.
- O HTML final é registrado no Storage (`FolderAsset` kind=entrega) via `register_delivery`. Template em `templates/propostas/`.

## 8. Fases

1. **Fase A (usável) — feita 9 nov 2026:** dados (§2) + seed + `create_opportunity_folder`, `create_file_in_folder`, `get_document_outline`, `read_section`, `upsert_section`, `append_to_document`. Templates do §3. REST `/api/workspaces/files/[id]/sections`.
2. **Fase B — feita 9 nov 2026:** UI "Nova oportunidade" + badges + vínculo com o funil + agente `propostas` no `cortex`.
3. **Fase C — feita 9 nov 2026:** `delete_section`, upload de transcrição, entrega HTML no Storage. Detalhe no §11.

## 11. Fase C — detalhe (9 nov 2026) — feita

1. **`delete_section`** (MCP + REST): `file_id`, `heading`, `expected_hash`. Heading inexistente → `not_found`; hash divergente → `conflict`. Grava `FileRevision` (restaurável). `destructiveHint: true`.
2. **Transcrição:**
   - UI "Importar transcrição" (.txt, .md, .vtt, .srt, .docx) → texto limpo, sem timestamps, mantendo o falante ("Fulano: texto") → `kind=transcricao`, TipTap válido, indexado.
   - Tool `import_transcript` (`folder_id`, `title`, `text`): o Quick transcreve o áudio do lado dele e envia o texto. Acima de 5 MB → divide em "(parte N)".
   - Áudio bruto **não** é processado no servidor. Opcional: guardar o original no bucket.
3. **Entregas:**
   - Bucket privado `opportunity-files`, path `{folderId}/entregas/{timestamp}-{slug}.html`.
   - Tabela nova `FolderAsset` (`id`, `folderId`, `kind` entrega|anexo|audio, `name`, `mimeType`, `size`, `path`, `createdBy`, `source`, `createdAt`) + RLS.
   - Rotas `/api/workspaces/folders/[id]/assets` (POST/GET), `/assets/[assetId]` (URL assinada curta, DELETE).
   - Tool `register_delivery` (`folder_id`, `name`, `html`) → Storage + `FolderAsset` → `{asset_id, url_assinada, expires_at}`.
   - UI "Entregas" na pasta: versões (mais recente no topo), abrir em iframe sandbox, baixar.
4. **Templates HTML:** `templates/propostas/` + README de placeholders (seção H2 → bloco HTML). Tool `get_proposal_template` (`name?`) → HTML base + mapa de seções.
5. **Agente `propostas`:** suggested_tools com `delete_section`, `import_transcript`, `register_delivery`, `get_proposal_template`. Prompt: "entrega = read_document → get_proposal_template → gerar HTML → register_delivery". Nova `AgentPromptVersion`.

Regras: nunca binário no Postgres (só path no Storage); service role só no servidor; reaproveitar libs A/B.

Aceite: `delete_section("Fora de escopo")` remove só ela e é restaurável; um .vtt importado vira transcrição limpa, com falantes, e aparece no `search_knowledge`; `register_delivery` aparece em "Entregas" e a URL assinada abre o arquivo; acima de 5 MB divide em partes.

## 9. Riscos

- Conversão markdown↔TipTap pode perder formatação → fatiar no JSON e testar.
- Edição simultânea na UI → `expected_hash`.
- Action Review do Quick não desenha botão com schema complexo → só strings, poucos campos; Sync no conector depois do deploy.
- Escopo `write` no OAuth do Quick → confirmar que o token do João tem.

## 10. Critérios de aceite

- Pelo Quick: criar a oportunidade "[TAMURA] Proposal" → aparecem pasta + Contexto + Proposal Doc na UI.
- `upsert_section("Escopo")` altera só o Escopo; tabelas de outras seções ficam intactas; revisão criada.
- Hash desatualizado → `conflict`, nada gravado.
- `cortex("montar proposta da Tamura")` → agente `propostas` + tools sugeridas.
- `contexto-plataforma.md` atualizado (estado atual + histórico).
