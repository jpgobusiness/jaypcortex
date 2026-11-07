/** Conteúdo condensado do Agente de Migração AWS. Fontes citadas no rodapé de cada doc. */

export const LAYERS: { layer: string; title: string; markdown: string }[] = [
  {
    layer: "identidade",
    title: "Prompt · Identidade",
    markdown: `# Identidade

Você é o **Agente de Migração AWS** da Nuage IT (JayP Cortex), papel **Arquiteto de Migração MAP**.

Tom: português do Brasil, objetivo, consultivo e técnico. Explique o “porquê” em uma frase antes de detalhar.

Público:
- Arquitetos de soluções e engenheiros da Nuage
- Comerciais que precisam de escopo, premissas e funding
- Clientes em conversa C-level (resumo executivo primeiro; detalhe técnico depois)

Você não substitui o PDM/AM da AWS nem o time comercial. Você estrutura, cita a base e marca o que precisa validação humana.
`,
  },
  {
    layer: "missao",
    title: "Prompt · Missão",
    markdown: `# Missão

Apoiar João Paulo e a Nuage IT em toda a jornada **MAP (Migration Acceleration Program)**: Assess → Mobilize → Migrate & Modernize.

Você entrega, sob demanda:
- Escopos de Assess (Cloud/Infra, Aplicações, Dados) alinhados aos templates da Nuage
- Propostas, SOW e narrativas comerciais
- Business case / TCO / ROI (estrutura e premissas; números de cliente só se estiverem na base)
- Plano de ondas em nível Assess (macro); detalhe fino é Mobilize
- Estratégia 7R por workload
- Plano de funding MAP (referência, validar com PDM/programa vigente)

Princípio: o que o MCP propõe, a UI também mostra e o humano edita no editor TipTap.
`,
  },
  {
    layer: "regras",
    title: "Prompt · Regras",
    markdown: `# Regras

1. **Citar a fonte** da base (título do arquivo). Se não houver fonte, dizer “não está na base”.
2. **Números de funding** são referência — validar com o PDM/AWS e o programa vigente. Nunca tratar como aprovado.
3. **Nunca inventar valores de cliente** (custos, vCPU, TB, ARR). Se faltar, listar a lacuna.
4. **Marcar premissas** explicitamente. Separar fato × estimativa × opinião.
5. **Seguir o template de proposta da Nuage** (3 frentes) quando o pedido for proposta/escopo de Assess.
6. **Priorizar o que mexe o ponteiro:** no Assess, aprofundar as 5 soluções de maior custo + até 2 core de negócio (máx. ~7 macroescopos).
7. Waves detalhadas, dependências máquina a máquina e landing zone operacional ficam no **Mobilize**, não no Assess.
8. Preferir propor (rascunho) a gravar direto, salvo pedido explícito de aplicar.
`,
  },
  {
    layer: "metodologia",
    title: "Prompt · Metodologia",
    markdown: `# Metodologia Nuage / MAP

## Três fases AWS MAP
Assess (diagnóstico e business case) → Mobilize (fundação e prontidão) → Migrate & Modernize (ondas, cutover, hypercare).

## Assess em 3 frentes (Nuage)
1. **Cloud/Infra** — inventário 100%, rightsizing, 7R, arquitetura-alvo, TCO de infra. Migration Evaluator ~30 dias quando on-prem/virtualizado.
2. **Aplicações** — agentes em repositórios (somente leitura) + entrevistas; score de prontidão; sem alterar código.
3. **Dados** — bancos transacionais e analíticos; BYOL × licença inclusa; modernização heterogênea quando fizer sentido.

Checkpoints quinzenais com o cliente. Sign-off do Assess libera Mobilize.

## Critério de profundidade
5 maiores custos + até 2 core. O restante em abordagem padrão, sem mergulho fino (ex.: não inspecionar 300 dashboards no Assess).
`,
  },
  {
    layer: "formato_saida",
    title: "Prompt · Formato de saída",
    markdown: `# Formato de saída

Use sempre esta estrutura, nesta ordem, salvo o usuário pedir outro formato:

1. **Resumo executivo** (5–10 linhas; o que, por quê, recomendação)
2. **Escopo / entregáveis** (lista ou tabela)
3. **Premissas e fora de escopo**
4. **Números** em tabela quando houver (unidade, fonte, “validar” se funding)
5. **Riscos**
6. **Próximos passos** (dono + prazo quando conhecido)

Idioma: português. Títulos curtos. Sem jargão AWS sem uma linha de tradução.
`,
  },
  {
    layer: "guardrails",
    title: "Prompt · Guardrails",
    markdown: `# Guardrails

- Não prometa funding aprovado, crédito em conta ou isenção comercial.
- Não exponha credenciais, IPs, dumps de inventário ou dados pessoais além do papel (ex.: “arquiteto”, “comercial”).
- Confidencialidade de dados de cliente: use só o necessário para o caso.
- Diferencie fato (está na base) × estimativa × opinião.
- Não grave TipTap como Markdown no banco — a conversão Markdown é só para MCP/leitura.
- Não abra signup, não apague dados, não invente tabelas fora do schema.
`,
  },
];

export const DOCS: { title: string; kind: string; tags: string[]; folder: "Base de conhecimento" | "Templates"; markdown: string }[] = [
  {
    title: "MAP — Visão geral do programa",
    kind: "metodologia",
    tags: ["map", "aws"],
    folder: "Base de conhecimento",
    markdown: `# MAP — Visão geral do programa

O **AWS Migration Acceleration Program (MAP)** é o programa da AWS para acelerar migração e modernização com metodologia, ferramentas e incentivos financeiros para o parceiro e, em alguns casos, para o cliente.

## Três fases
| Fase | Objetivo | Papel típico do parceiro |
|---|---|---|
| **Assess** | Inventário, 7R, TCO/ROI, arquitetura-alvo, business case | Diagnóstico; funding de Assess costuma isentar o cliente do fee do parceiro |
| **Mobilize** | Landing zone, governança, CCoE, plano de ondas detalhado, pilotos | Fundação; créditos/cash conforme regras vigentes |
| **Migrate & Modernize** | Execução por ondas, cutover, hypercare, modernização | Fábrica de migração; incentivos atrelados a ARR incremental |

## Papéis
- **Parceiro (Nuage IT):** executa Assess/Mobilize/Migrate, registra oportunidade no ACE, aplica tagging \`map-migrated\`, comprova ARR.
- **PDM / AM AWS:** valida elegibilidade, funding e o programa vigente.
- **Cliente:** acessos somente leitura, entrevistas, sign-off.

Valores de incentivo: **validar no programa vigente**.

Fonte: conhecimento público MAP AWS (validar docs oficiais) + prática Nuage nos casos Vero e HeroSpark.
`,
  },
  {
    title: "Fase Assess",
    kind: "metodologia",
    tags: ["map", "assess"],
    folder: "Base de conhecimento",
    markdown: `# Fase Assess

## Objetivo
Diagnóstico profundo do ambiente atual alinhado a objetivos de negócio, para um **caso de negócio único** (TCO, ROI, roadmap).

## Ferramentas
- AWS Migration Evaluator (coleta ~30 dias quando aplicável)
- AWS Transform assessments / Pricing Calculator
- MRA (Migration Readiness Assessment) quando pedido
- APIs/exports da nuvem de origem (OCI, Azure, Magalu, etc.)
- Agentes Nuage em repositórios (somente leitura)

## Entregáveis típicos
- Inventário 100% (omitir servidor só com formalização de Retire)
- 7R por workload
- Rightsizing e memória de cálculo AWS
- Arquiteturas (rede, contas/LZ, prod e réplicas de hml/dev)
- TCO/ROI e business case
- Riscos, premissas, prazo **macro** (sem waves finas)

## Duração
4–8 semanas é o típico; a Nuage usa jornada com checkpoints quinzenais. Sign-off do Assess libera Mobilize.

Fonte: \`proposal-assess-3-areas.md\`; kickoff interno Vero (delimitação Assess vs Mobilize).
`,
  },
  {
    title: "Fase Mobilize",
    kind: "metodologia",
    tags: ["map", "mobilize"],
    folder: "Base de conhecimento",
    markdown: `# Fase Mobilize

Fase de **prontidão**. Não começa sem sign-off do Assess.

## O que entra
- Landing zone / Control Tower e organização de contas
- MRP (Migration Readiness Planning)
- CCoE e operating model
- Segurança, identidade, governança e logging
- Pilotos (quando reduzem incerteza real)
- Plano de ondas **detalhado** (dependências, sequenciamento, RTO/RPO)
- Capacitação do time do cliente
- OLA (Optimization and Licensing Assessment) se ainda não fechou sizing/licenças

## O que não é Mobilize
Descoberta de inventário e business case — isso é Assess. Execução em massa de cutover — isso é Migrate.

Fonte: prática MAP AWS (validar) + kickoff interno Vero (PC: landing zone e Mobilize; waves no Mobilize).
`,
  },
  {
    title: "Fase Migrate & Modernize",
    kind: "metodologia",
    tags: ["map", "migrate"],
    folder: "Base de conhecimento",
    markdown: `# Fase Migrate & Modernize

## Execução
Fábrica de migração por ondas, com runbooks, janelas e hypercare.

## Ferramentas típicas
- **MGN** — rehost de servidores
- **DMS** — bancos
- **DataSync** — arquivos/objetos
- **AWS Transform** — modernização assistida quando couber
- Containers (EKS/ECS), serverless (Lambda), bancos gerenciados (RDS/Aurora)

## Modernização
Não é obrigatória em todo workload. 7R decide. Refactor só com justificativa da frente de Aplicações.

Fonte: conhecimento MAP AWS (validar) + templates Nuage de Assess (destino sugerido, execução na fase seguinte).
`,
  },
  {
    title: "Incentivos e funding MAP",
    kind: "referencia",
    tags: ["map", "funding", "ace"],
    folder: "Base de conhecimento",
    markdown: `# Incentivos e funding MAP

**Todos os valores: referência — validar no programa vigente com o PDM/AWS.**

## Tipos comuns (nomes variam por ano)
- **Funding de Assess** para o parceiro (muitas vezes usado para isentar o fee do cliente)
- **Créditos/cash de Mobilize**
- **Incentivos de Migrate** atrelados a **ARR incremental** na AWS
- **POC credits**
- Programas específicos: Windows/SQL, SAP, mainframe, storage, ISV

## Elegibilidade (padrão histórico)
Workload ainda não na AWS (ou ARR novo), oportunidade registrada no **ACE**, tagging \`map-migrated\`, evidência de migração e ARR.

## Como maximizar
1. Registrar a oportunidade no ACE **cedo**
2. Fechar o Assess com entregáveis que sustentam o business case
3. Combinar programas (ex.: OLA + MAP) sem double-dip indevido
4. Tagging consistente
5. Comprovar ARR no claim

## Armadilhas
Prometer isenção ou crédito como se já estivesse aprovado; esquecer ACE; não separar o que é funding do parceiro vs crédito do cliente; usar números de outro ano.

Fonte: prática Nuage (HeroSpark: fee de Assess isento via MAP Assess, valor da proposta R$ 124.713,55 — validar se reaplicar) + docs públicos MAP (validar).
`,
  },
  {
    title: "Como maximizar o funding (playbook Nuage)",
    kind: "processo",
    tags: ["funding", "ace", "nuage"],
    folder: "Base de conhecimento",
    markdown: `# Como maximizar o funding (playbook Nuage)

Passo a passo operacional:

1. **Oportunidade no ACE** — nome do cliente, ARR estimado, fase MAP, parceiro Nuage.
2. **Aprovação do Assess** — PDM confirma funding de Assess.
3. **Isenção ao cliente** — o fee da Nuage pode ser coberto pelo funding (exemplo HeroSpark: proposta de Assess com R$ 124.713,55 isentos via MAP Assess). Tratar como **caso**, não como regra automática.
4. **Plano de ARR** — o que entra na AWS, em que onda, quanto de run-rate.
5. **Tagging** \`map-migrated\` nos recursos migrados.
6. **Claim** com evidências (ACE, tagging, faturas).
7. **Mobilize/Migrate** — novos envelopes de incentivo, sempre validar vigência.

Kickoff interno Vero: incentivo MAP citado com teto de **US$ 75 mil** para o projeto master (infra+dados); MAPs adicionais por workload via business case/KWS. **Validar**.

Fonte: \`referencia-base.md\` (HeroSpark); kickoff interno Vero 10/07/2026.
`,
  },
  {
    title: "Como a Nuage executa o Assess (3 frentes)",
    kind: "processo",
    tags: ["assess", "nuage", "3-frentes"],
    folder: "Base de conhecimento",
    markdown: `# Como a Nuage executa o Assess (3 frentes)

Template oficial: **Assess em Cloud · Aplicações · Dados**, consolidado num único caso de negócio.

## Premissas gerais
- Baixo impacto operacional; coleta automatizada + entrevistas
- Acesso **somente leitura**
- Confidencialidade / NDA no kick-off
- KPIs e regiões definidos no kick-off (ex.: produção em São Paulo, hml/dev em N. Virginia)

## Cloud / Infra
Inventário 100%, OS/EOL, storage, rede, segurança, DR, custos atuais. Migration Evaluator ≥30 dias quando on-prem. Destino: EC2/EKS/ECS, LZ, memória de cálculo.

## Aplicações
Agentes nos repositórios (sem PR, sem alterar código). Até N repositórios priorizados. Score de prontidão, mapa de dependências, 7R por app.

## Dados
Inventário de motores/edições, BYOL vs LI, analítico (lake/warehouse/BI). Destino RDS/Aurora, DMS, stack analítica AWS ou Databricks na AWS conforme abertura a gerenciados vs zero lock-in.

## Jornada
D0 kick-off → coleta → checkpoints quinzenais → relatório único (TCO/ROI + roadmap).

Fonte: \`/Users/jpgoncalves/Documents/assessment-escopo-proposol-3-areas/proposal-assess-3-areas.md\`.
`,
  },
  {
    title: "Caso Vero — Assess OCI/Azure → AWS",
    kind: "caso",
    tags: ["vero", "oci", "azure", "assess"],
    folder: "Base de conhecimento",
    markdown: `# Caso Vero — Assess OCI/Azure → AWS

**Em uma linha:** infra/sistemas na **OCI**, dados na **Azure**. Gasto ~R$ 5,3–5,5 mi/ano. Motivador nº 1: **custo**.

## OCI (infra)
- ~293 instâncias (244 VMs + 49 nós em 3 OKE) · ~1.756 vCPU · ~4,3 TB RAM · ~123 TB disco
- 25 bancos gerenciados (Oracle, MySQL, PostgreSQL) — inventário fino a fechar
- Maior bloco: 115 VMs PABX 3CX (B2B)
- FastConnect 10 Gbps Equinix; DR Vinhedo (frio, ativação manual)
- Custo R$ 250–270 mil/mês; contrato até fim de 2027

## Azure (dados)
- Databricks, Fabric/Power BI (~300 dashboards), ADF, Event Hubs, lake ~36 TB
- ~R$ 2,3 mi/ano
- Preferência do cliente: desligar Azure, evitar lock-in; comparar Databricks vs stack nativa AWS
- QuickSight: no Assess, viabilidade/arquitetura/licenciamento — **não** migrar dashboard a dashboard

## Delimitação (kickoff interno 10/07/2026)
- Assess: TCO AWS, arquitetura-alvo por macroescopo, riscos/premissas, prazo macro
- Mobilize: waves, dependências finas, LZ operacional
- Profundidade: 5 maiores custos + até 2 core (~7)
- OLA em paralelo
- Incentivo MAP citado: teto US$ 75 mil no master (validar)
- Ferramentas internas: \`gerar_planilha_sizing.py\` (1 OCPU = 2 vCPU; 293 VMs) e \`gerar_planilha_de_para.py\` (Azure→AWS)

Pessoas: citar só papéis (arquiteto, comercial, infra, dados). Sem credenciais/IPs.

Fontes: \`cenario-atual-vero.md\`; \`[VERO] KICK OFF INTERNO - 10-07-2026-*.md\`; \`vero-map-assess/gerar_planilha_sizing.py\`.
`,
  },
  {
    title: "Caso HeroSpark — Assess Magalu/Azion → AWS",
    kind: "caso",
    tags: ["herospark", "magalu", "azion", "assess"],
    folder: "Base de conhecimento",
    markdown: `# Caso HeroSpark — Assess Magalu/Azion → AWS

HeroSpark (educação online / infoprodutos). Plataforma all-in-one: checkout, membros, vídeo, mobile.

## Cenário atual (pré-venda)
- 3 clusters Kubernetes na Magalu Cloud (3 AZs) · 118 nós (93 prod / 18 staging / 7 Eadbox)
- 470 vCPU · 956 GiB · 50 VMs (bancos/caches/filas) · 7,4 TB NVMe
- 495 TB vídeo no Edge Storage Azion (+6 TB/mês); CDN 55–111 TB/mês
- Cloudflare na frente (DNS, WAF, túnel)
- AWS hoje: resíduo (RabbitMQ, app web alunos, multiupload, Atlas)
- GPUs fora do k8s (VMs L40 MGC + Open Datacenter)

## Proposta
Assess (modelo mais enxuto de Cloud neste artefato) com fee **R$ 124.713,55 isento via MAP Assess** (exemplo histórico — validar vigência).

Fontes: \`referencia-base.md\` (HEROSPARK - ETAPA ASSESS DO MAP).
`,
  },
  {
    title: "Estratégias 7R",
    kind: "referencia",
    tags: ["7r", "migracao"],
    folder: "Base de conhecimento",
    markdown: `# Estratégias 7R

| R | Significado | Quando |
|---|---|---|
| **Rehost** | Lift-and-shift (MGN) | Prazo curto, app estável, pouco ganho em refactor |
| **Relocate** | Mover hypervisor/plataforma com pouca mudança | VMware/outras plataformas com caminho nativo |
| **Replatform** | Ajuste de plataforma (ex.: RDS, containers) | Ganho operacional sem reescrever |
| **Repurchase** | Trocar por SaaS | Produto de mercado cobre o caso |
| **Refactor** | Reescrever / cloud-native | Só com frente de Aplicações justificando |
| **Retire** | Desligar | Cliente formaliza que pode sair do escopo |
| **Retain** | Fica onde está | Restrição legal, mainframe, ou fora da onda |

Sinais no inventário: EOL de OS, licença cara (Oracle/SQL/Windows), baixa utilização (rightsizing), acoplamento (ondas), 3CX/PABX (rehost ou repurchase), dashboards (não migrar 1:1 no Assess).

Fonte: \`proposal-assess-3-areas.md\` (estratégia 7R por workload).
`,
  },
  {
    title: "Checklist de kickoff de Assess",
    kind: "passo_a_passo",
    tags: ["kickoff", "assess"],
    folder: "Base de conhecimento",
    markdown: `# Checklist de kickoff de Assess

## Partes
Sponsor, infra, apps, dados, segurança, comercial Nuage, arquiteto Nuage, PDM/AM AWS.

## Acessos (somente leitura)
- Nuvem de origem (OCI/Azure/MGC/on-prem): export de inventário, billing, APIs
- Repositórios priorizados
- Bancos: metadados/sizing, não dump irrestrito
- Migration Evaluator / OLA

## Alinhar no D0
- KPIs e critério de sucesso
- Regiões AWS (prod vs hml/dev)
- Compliance (LGPD: produção no Brasil?)
- Abertura a serviços gerenciados vs zero lock-in
- NDA
- Cronograma e checkpoints quinzenais
- Limite de profundidade (5 custos + 2 core)
- O que é Assess vs Mobilize
- ACE já registrada?

Fonte: premissas de \`proposal-assess-3-areas.md\` + decisões do kickoff interno Vero.
`,
  },
  {
    title: "Glossário MAP",
    kind: "referencia",
    tags: ["glossario", "map"],
    folder: "Base de conhecimento",
    markdown: `# Glossário MAP

- **ARR** — Annual Recurring Revenue na AWS; base de muitos incentivos de Migrate.
- **ACE** — APN Customer Engagements; registro da oportunidade.
- **PDM** — Partner Development Manager (AWS).
- **AM** — Account Manager AWS do cliente.
- **MRA** — Migration Readiness Assessment.
- **MRP** — Migration Readiness Planning (Mobilize).
- **MGN** — AWS Application Migration Service (rehost).
- **DMS** — Database Migration Service.
- **TCO** — Custo total de propriedade.
- **LZ** — Landing Zone.
- **CCoE** — Cloud Center of Excellence.
- **BYOL** — Bring Your Own License.
- **LI** — License Included.
- **OLA** — Optimization and Licensing Assessment.
- **7R** — estratégias de migração.
- **MAP tagging** — tag \`map-migrated\` para claim.

Fonte: prática MAP + templates Nuage.
`,
  },
  {
    title: "Template · Proposta Assess 3 frentes",
    kind: "template",
    tags: ["template", "proposta", "assess"],
    folder: "Templates",
    markdown: `# Template · Proposta Assess 3 frentes

Usar o arquivo oficial como esqueleto. Reescrever **somente** “Sobre o cliente” e “Visão do Cenário Atual”.

## Capa
Comercial · Arquiteto · Empresa · Site

## Sobre o cliente
Segmento, porte, produtos, indicadores. Lista das plataformas no escopo.

## Visão do cenário atual
Infra (origem, VMs, vCPU, RAM, k8s, TB, rede). Apps (nº, linguagens, modelo). Dados (instâncias, TB, motores, analítico). Quem faz o quê.

## Escopo — 3 frentes
Tabela: Cloud/Infra · Aplicações · Dados. Premissas: baixo impacto, read-only, confidencialidade, KPIs no kick-off.

## Entregáveis por frente
Manter o texto padrão do template (inventário 100%, 7R, rightsizing, diagnóstico de apps, BYOL×LI).

## Fora de escopo / Mobilize
Waves finas, correção de código, migração dashboard a dashboard.

Fonte: \`proposal-assess-3-areas.md\` (template oficial Nuage).
`,
  },
  {
    title: "Template · Proposta Assess só Cloud",
    kind: "template",
    tags: ["template", "proposta", "cloud"],
    folder: "Templates",
    markdown: `# Template · Proposta Assess só Cloud

Versão mais enxuta (modelo HeroSpark, anonimizado).

## Capa e cliente
Preencher comercial, arquiteto, empresa, site, parágrafo de negócio **sem** copiar dados confidenciais de outro cliente.

## Cenário atual
Números de pré-venda: clusters, nós, vCPU, RAM, storage, CDN, provedores.

## Escopo
Varredura de infra, rede, identidade, licenciamento, Migration Evaluator 6 semanas com checkpoints.

## Entregáveis
Visão de migração, roadmap, projeção de custos. Sem frente formal de Apps/Dados neste modelo.

## Funding
Linha de fee e, se aplicável, “isentos via MAP Assess — validar programa vigente”.

Fonte: \`referencia-base.md\` (estrutura; dados HeroSpark não devem ser colados em proposta de outro cliente).
`,
  },
  {
    title: "Template · E-mail de levantamento de informações",
    kind: "template",
    tags: ["template", "email", "kickoff"],
    folder: "Templates",
    markdown: `# Template · E-mail de levantamento

Assunto: [Cliente] — insumos para o Assess MAP

Olá, [nome],

Para iniciarmos o Assess com baixo impacto, pedimos:

1. Export de inventário da nuvem de origem (compute, disco, k8s, bancos, rede)
2. Faturas / contrato dos últimos 3–12 meses (sem dados de cartão)
3. Lista de aplicações e donos + repositórios autorizados (somente leitura)
4. Inventário de bancos (motor, edição, tamanho, HA)
5. Premissas: regiões AWS, LGPD, abertura a serviços gerenciados
6. Contatos de infra, apps, dados e segurança para entrevistas

As ferramentas operam em **leitura**. Não alteramos servidores, código ou bancos.

Prazo sugerido: [data]. Checkpoints quinzenais já na agenda.

Obrigado,  
[Arquiteto Nuage]
`,
  },
  {
    title: "Template · Business case / TCO (estrutura)",
    kind: "template",
    tags: ["template", "tco"],
    folder: "Templates",
    markdown: `# Template · Business case / TCO

1. **Situação atual** — run-rate anual por provedor (infra vs dados vs licenças)
2. **Cenário AWS** — compute, storage, rede/data transfer, bancos, observabilidade, suporte
3. **Licenciamento** — BYOL vs LI (OLA)
4. **Funding MAP** — linha à parte, marcada “validar”
5. **Migração (one-time)** — esforço Nuage + ferramentas + hypercare
6. **ROI** — payback em meses; premissas de câmbio e crescimento
7. **Não quantificado** — risco operacional, EOL, lock-in
8. **Recomendação** — seguir / fatiar / não migrar X

Nunca misturar funding com TCO de run-rate sem deixar explícito.
`,
  },
  {
    title: "Template · Plano de ondas (estrutura)",
    kind: "template",
    tags: ["template", "ondas", "mobilize"],
    folder: "Templates",
    markdown: `# Template · Plano de ondas (estrutura)

No **Assess**: só ordem de grandeza e critérios. Detalhe = Mobilize.

## Critérios de onda
Dependências, criticidade, janela, 7R, quick wins de custo.

## Colunas sugeridas
Onda | Workloads | 7R | Pré-requisitos LZ | Risco | Janela macro | ARR estimado

## Exemplo de leitura
Onda 0: LZ + piloto não crítico.  
Onda 1: storage/DR ou workload de maior custo com Rehost.  
Ondas seguintes: apps acopladas juntas; dados com DMS após destino pronto.

Fonte: delimitação Assess vs Mobilize (kickoff Vero) + 7R do template 3 frentes.
`,
  },
];
