# Contexto do projeto e roadmap de longo prazo

> Documento de continuidade para o responsável, novos programadores e agentes de IA.
> Leia este arquivo antes de planejar trabalho novo. Ele registra o estado conhecido,
> o caminho de profissionalização e a visão do futuro modo carreira de jogador.

## 1. Como interpretar este documento

As decisões estão classificadas assim:

- **Decidido:** contrato vigente; não mudar incidentalmente.
- **Recomendado:** direção técnica preferida, ainda executada gradualmente.
- **Aberto:** decisão de produto ou arquitetura que precisa ser confirmada antes
  de produzir comportamento definitivo.

Este documento não substitui as fontes especializadas:

- `AGENTS.md`: regras de trabalho, branch, invariantes e validação;
- `docs/next-steps.md`: sequência aprovada de auditoria individual, variância,
  campanha, balanceamento condicional e retomada;
- `docs/architecture.md`: arquitetura e dependências permitidas;
- `docs/formulas/`: roles, playstyles, OVR e química;
- `docs/testing.md`: estratégia e comandos de teste;
- `docs/realism-methodology.md`: IFCS, corpus real e nota de fidelidade 0–100;
- `docs/rating-balance-2026-07-20.md`: auditoria do rating e comparação controlada;
- `docs/fidelity-corpus.md`: contrato operacional de coleta e auditoria do corpus;
- `docs/adr/`: decisões arquiteturais;
- `docs/baseline.md`: baseline estatístico e estrutural;
- `docs/glossary.md`: vocabulário do domínio.

Quando houver divergência, código executável + testes + ADR aceito têm precedência.
Atualize este documento quando uma decisão aberta for fechada ou uma etapa do
roadmap for concluída.

## 2. Ponto exato de retomada

Atualização vigente de 30 de julho de 2026 (tem precedência sobre o registro
histórico abaixo):

- o handoff operacional do ciclo P5 está em
  `docs/p5-aplicacao-ui-2026-07-29.md`; ele registra commits, validações, contratos
  dos estados restantes e a próxima fatia segura;
- `AGENTS.md` registra autorização persistente para o agente executar a próxima
  fatia segura, limpar legado comprovadamente dispensável, criar commits e fazer
  push de checkpoints verdes para `sandbox-test` sem renovar a permissão;
- o refinamento **Tactical Editorial** das cartas está publicado em `bf5d5e5`:
  sem halos ou varredura de luz, movimento curto, raridade por marcas, treinador
  neutro e verso sem OVR/RTG/pesos visuais. Campeonato e colocação permanecem
  visíveis em jogador e treinador, inclusive no compacto;
- a guarda mede 156 cartas (152 da bancada-base + 4 comparadores) em oito
  larguras e também prova fontes mínimas, grade editorial,
  contraste de 4,5:1, conteúdo obrigatório, ausência de halo, keyframes limpos,
  teclado, frente/verso, reduced motion e touch. O contrato detalhado está em
  `docs/cartas-design-2026-07-28.md`, seção 11;
- **existe uma proposta visual ATIVA e NÃO promovida** no bloco `#proposta` do
  laboratório: escada de seis faixas por OVR, bordas cromadas no 20/21/22, paleta
  de função reconstruída, treinador reformulado e a primeira fatia de retrato
  (`fotos/donk_kato24.webp`). O jogo continua no design publicado. Contrato,
  decisões medidas, hipóteses reprovadas e o que falta para promover estão na
  **seção 12** de `docs/cartas-design-2026-07-28.md`;
- o responsável escolheu o enquadramento A (`100% auto`, `50% 12%`) no bloco `0`
  do laboratório. O A refinado preserva mais retrato que o jogo com placas de
  35%/31%, recupera margem inferior, separa nick e playstyle no verso e fixa o
  filete da era para campeonatos de uma ou duas linhas. O A de `369c480` permanece
  ao lado como referência; falta a conferência no Pages antes dos cinco retratos
  restantes;
- validação integral desse marco: `npm run validate`, **25/25 suítes verdes** em
  182,2 s; snapshot, golden, consumo de RNG e balanceamento permaneceram intactos;
- validação integral do refinamento editorial do A: `npm run validate`, **25/25
  suítes verdes** em 186,1 s; snapshot e golden permaneceram idênticos;
- CI e deploy do commit `bf5d5e5`: workflow `30527422214`, verde;
- o ciclo **P2 de modularização por paridade está concluído**, Fases 0–7;
- `game.js` caiu de 3.054 para **889 linhas** — 1.206 ao fim do P2, 938 depois das
  primeiras fatias do P5, 888 após a remoção do tilt morto e uma linha de import
  no endurecimento das cartas — e contém somente
  aplicação, estado e UI;
- dados e motores vivem em `src/data`, `src/domain` e `src/public`;
- jogo, sandbox, worker e bancada usam `src/public/simulation-api.mjs`;
- `bancada/motor.js` cria estado avaliado e sessão de RNG novos por carga, sem
  `vm`, recorte de texto ou lista manual de exports;
- `tools/add-team.js` escreve apenas nos dois módulos crus e regenera
  `elencos.html` de forma transacional;
- os 28 checadores diferenciais de migração foram aposentados depois da última
  prova verde; os contratos permanentes são API pública, vetores congelados de
  RNG, catálogo, snapshot, goldens, regressão, benchmark e E2E;
- nenhuma etapa desse ciclo alterou dados, classificação, `CFG_*`, RNG,
  balanceamento, snapshot ou goldens.
- validação final do ciclo: `npm run validate`, 24/24 suítes em 168,3 s.

Registro histórico de 22 de julho de 2026:

- produto: **draft9-0**, jogo estático de navegador sobre Counter-Strike;
- repositório: `esteban-brito/Teste`;
- branch de trabalho: `sandbox-test`;
- `main`: intocável durante a profissionalização;
- **estado atual: `d3d43c5`, ciclo de fidelidade da simulação concluído e publicado
  (ver seção 2-bis, que tem precedência sobre o restante desta seção);**
- último estado funcional publicado antes do registro original:
  `c3e2355 docs(sandbox): record diagnostic polish`;
- branch local e `origin/sandbox-test` sincronizadas e limpas após a publicação;
- Pages do sandbox: <https://esteban-brito.github.io/Teste/sandbox.html>;
- o E2E do jogo percorre draft, lineup, Suíça, playoffs, título e reinício;
- workflow do commit `c3e2355`: sucesso em validação e deploy;
- run do GitHub Actions: `29955558168`;
- última validação local completa: 19/19 suítes em 195,6 s, com 45.900 mapas
  e 938.511 rounds nos benchmarks;
- nenhuma mudança IFCS alterou motor, dados, configuração, RNG ou balanceamento;
- o alvo IFCS de 22/01/2026 a 07/07/2026 está congelado com fontes e hashes; a
  revisão 2 corrige a troca oficial de Train por Anubis antes da coleta;
- o extrator reproduziu duas vezes uma demo CS2 real; a prova FACEIT acadêmica
  valida o pipeline, mas não pertence ao corpus profissional;
- o primeiro mapa profissional elegível foi extraído duas vezes: FURIA 8–13
  Falcons no IEM Cologne Major 2026; o corpus está em 1/800 mapas e 1/6 eventos;
- o diagnóstico técnico preliminar marcou 96/100 em 4.000 mapas simulados
  (131/136 avaliações dentro das faixas); não é a nota IFCS oficial;
- ainda não existe corpus real auditado nem nota IFCS oficial;
- R1, a auditoria individual aprofundada, está publicada no commit `b97b3d7`,
  sem alteração de motor ou balanceamento;
- o ADR 0002 foi aceito e a trilha estrutural P1 começou: `ATRIBUTOS`,
  `TIMES_DEF` e os mapas de país possuem cópias de migração em `src/data`,
  protegidas por paridade integral no `npm run check`. Em 28/07/2026 o
  `PAISES_MAP` único virou `PAIS_JOGADOR` (por ID cru) e `PAIS_TREINADOR` (por
  nome), separando espaços de nome que estavam misturados — mudança de contrato,
  sem mudança de valor;
- `bancada/times.js` e `bancada/snapshot.js` já consomem os novos módulos para
  dados crus; o snapshot deixou de manter um `new Function` próprio;
- os ADRs 0004 e 0005 foram aceitos. `tools/add-team.js` agora projeta uma nova
  adição nos módulos e em `game.js` pela mesma operação, preserva quebras de
  linha, valida paridade e restaura fontes/`elencos.html` em caso de falha;
- P2 começou pelas funções puras `rolePairReality`, `secondaryScore` e
  `roleStyleReality`, extraídas para `src/domain` e comparadas exatamente em
  11.319, 724.416 e 37.800 cenários, respectivamente. A auditoria rápida já
  consome as duas regras de realidade por dependência explícita; jogo, sandbox e
  simulador ainda usam o legado;
- `game.js` continua sendo a fonte de verdade executável e os módulos ainda são
  cópias transitórias. Não remover os blocos legados nem migrar navegador,
  sandbox, worker ou gerador sem a próxima prova de paridade;
- R2 foi concluída como trilha científica/visual separada, sem mudança no motor,
  RNG ou balanceamento. Não combinar a próxima etapa funcional, modularização
  estrutural e balanceamento na mesma mudança;
- R3 já possui uma MD3 isolada e determinística. A decisão de produto para a
  próxima retomada é congelar o design atual e implementar a distribuição entre
  muitas campanhas MD3, sem novo polimento visual ou balanceamento incidental.

Atualização operacional de 23 de julho de 2026:

- R4.1 e R4.2 foram publicadas até `8136df1`; a auditoria profunda e a
  telemetria opcional caracterizam 1.088 mapas e 22.446 rounds sem alterar RNG;
- o diagnóstico confirmou ausência de identidade própria de save para AWPer e
  probabilidades quase uniformes de trade/crédito KAST entre roles;
- o plano mestre R5 está em `docs/r5-plan.md` e o contrato executável em
  `docs/r5-experiment.json`;
- R5.0–R5.1 concluíram a comparação pareada, com 1.088 mapas, 10.880
  player-maps, delta nulo e detecção sintética. Nenhum balanceamento foi
  misturado a essa infraestrutura.
- R5.2 removeu os pisos/tetos duros de forma e rating com caudas suaves,
  positivas e ilimitadas, sem adicionar pontos de RNG. A comparação pareada e
  o benchmark integral não detectaram deslocamento material do centro; detalhes
  estão em `docs/r5-tail-balance-2026-07-23.md`.
- R5.4 extraiu `combatProfile` e as parcelas somáveis de `fallenAngels` com
  golden idêntico e delta zero em 1.088 mapas/10.880 player-maps. A role ativa
  do IGL não mudou; detalhes em `docs/r5-structural-extraction-2026-07-23.md`.
- por decisão do responsável, o corpus IFCS completo de 800 mapas não é
  pré-requisito operacional deste ciclo. Ele permanece opcional para futura
  certificação; o produto não alegará nota IFCS oficial sem esse corpus;
- R5.5 ativou a função de combate secundária já classificada dos IGLs, sem criar
  multiplicadores. A comparação pareada teve deltas globais imateriais e o
  benchmark melhorou correlação/MAE do rating; evidência em
  `docs/r5-effective-role-balance-2026-07-23.md`.
- a parcela de exposição da R5.6 substituiu a seleção genérica da vítima por
  volume residual e contexto contínuo de função, atributos, lado e fase. Entry
  passou a liderar as mortes de abertura por pequena margem sem deslocamento
  material global; evidência em `docs/r5-exposure-balance-2026-07-23.md`.
- o candidato separado de save acrescentou valor abstrato dos sobreviventes à
  decisão coletiva existente. Save de AWPer subiu cerca de 10% em termos
  relativos, enquanto save e produção globais ficaram estáveis; evidência em
  `docs/r5-save-balance-2026-07-23.md`.
- R5.7a condicionou a oportunidade de refrag à prontidão dos vivos e à
  possibilidade de troca da vítima. Entry e Support passaram a ser trocados com
  maior frequência sem inflar trades globais; evidência em
  `docs/r5-trade-balance-2026-07-23.md`.
- R5.7b condicionou a oportunidade de assistência à utilidade disponível dos
  quatro companheiros elegíveis. APR global permaneceu estável e a separação
  entre facilitadores e finalizadores aumentou sem bônus direto por função ou
  KAST; evidência em `docs/r5-assist-balance-2026-07-23.md`.
- R5.8 reconstruiu e mediu as onze parcelas do rating em 61.200 mapas-alvo. O
  prior atual `0,450` ficou praticamente no ótimo `0,455`; como o candidato
  piorou MAE/RMSE na validação, nenhum peso foi alterado. Evidência em
  `docs/r5-rating-audit-2026-07-23.md`.
- R6 fechou o ciclo com comparação acumulada, 19/19 suítes e os três E2E. O
  resultado, os números finais e os limites honestos estão em
  `docs/r6-closure-2026-07-23.md`.

Atualização operacional de 24 de julho de 2026:

- o commit `f731b3a` aplicou no código os overrides produzidos pelo editor do
  sandbox para kennyS, NBK-, Happy, apEX da EnVyUs, kioShiMa e RUSH;
- `game.js` e `src/data/players.mjs` permanecem em paridade, `elencos.html` foi
  regenerado e o snapshot continua cobrindo os 85 IDs;
- o snapshot derivado passou a registrar NBK- `Rifler/Support · Trader · 15`,
  Happy `IGL/Lurker · Infiltrador · 19`, apEX `Entry/Rifler · Opener · 17` e
  RUSH `Entry/Rifler · Spacetaker · 17`;
- como o simulador centraliza sinais pela população completa de jogadores, a
  alteração não ficou restrita aos dois times: o golden NAVI × Outsiders da
  seed 1 mudou de 5–13 para 7–13 e a campanha MD3 da seed 424242 mudou de
  vencedor;
- a validação posterior ao commit passou em 19/19 suítes, com 45.900 mapas e
  937.856 rounds. Rating real×sim ficou em correlação `0,955`, MAE `0,050`,
  inclinação `1,016` e maior erro individual `0,178`;
- o JSON original exportado pelo sandbox e fontes externas para justificar os
  novos atributos não estão versionados. Os valores são executáveis e passam
  nos gates, mas a proveniência histórica ainda precisa ser registrada antes de
  tratá-los como uma revisão cientificamente auditada.

## 2-bis. CICLO DE FIDELIDADE DA SIMULAÇÃO — 26 e 27 de julho de 2026

> Ciclo de cinco etapas pedido pelo responsável, concluído e publicado em
> `origin/sandbox-test` (`a884742..d3d43c5`). **Leia esta seção antes de qualquer
> trabalho novo no simulador.**

### O que foi entregue, em ordem

| Commit | Etapa | Documento |
|---|---|---|
| `ce8133f` | Bancada multi-fator (medição pura) | `docs/baseline-simulacao-2026-07-26.md` |
| `7119305` | Identidade única: o playstyle | `docs/identidade-playstyle-2026-07-26.md` |
| `0d62d10` | O rating emerge da carta | `docs/rating-da-carta-2026-07-26.md` |
| `798908e` | O round ganha um relógio real | `docs/relogio-do-round-2026-07-26.md` |
| `7cf6bed` | Economia e arsenal reais | `docs/economia-real-2026-07-26.md` |
| `d3d43c5` | Correção da flag de estrela + dificuldade pelo draft real | `docs/fechamento-dificuldade-2026-07-27.md` |
| `aa5841a` | Instrumento: varredura pareada e intervalo de Wilson | este arquivo, §2-bis |
| `93f188a` | O medidor de dificuldade passa a medir o draft do jogo | `docs/dificuldade-invicto-2026-07-27.md` |
| `b6156fd` | Abertura decidida por exposição, não por firepower | `docs/abertura-2026-07-27.md` |
| `a92b210` | Campanha invicta entra na faixa de 4–6% | `docs/dificuldade-invicto-2026-07-27.md` |
| `41d6b86` | Goldens regravados | mensagem do commit |

Validação final: **24/24 suítes verdes**, incluindo os três E2E. `realismo.js` fecha
**12/12 macro e 6/6 forma**, `perfis.js` fecha **15/15** e `dificuldade.js` fecha **4/4** —
a primeira vez que as três camadas fecham juntas.

### Mudanças de contrato que uma sessão futura precisa conhecer

- **O rating histórico entra UMA vez, dentro do OVR (`nmOVR`).** Nenhum ponto do motor
  o lê depois disso; `ratingCompetitivo` foi removida. Reintroduzir essa leitura é
  regressão e `bancada/perfis.js` reprova.
- **`bancada/rating.js` deixou de ser gate** e virou relatório: a correlação real×sim
  era circular. Só a cobertura (85/85) continua obrigatória. O gate de qualidade
  individual é `bancada/perfis.js`.
- **O sub-arquétipo não existe mais.** `SUBARQ`, `SUB_BY_STYLE`, `ESTEIRA`, `ehCoringa`
  e os campos `sub`/`esteira` foram removidos. Agressão e afinidade de lado saem de
  `PLAYSTYLES[id].traits`, extraídos em `src/domain/evaluation/style-identity.mjs`.
- **O round roda sobre relógio** (115 s + 40 s de bomba, tiques de 5 s). `CLOSE_MEN`,
  `RND_TEMPO` e `PP_TEMPO` não existem mais.
- **A economia é por jogador.** `mA`/`mB` viraram `dinA[5]`/`dinB[5]`; custos de CS2;
  drop de arma; recompensa por kill pela arma; `FA_ECO` usa a arma do jogador.
- **`bancada/perfis.js` e `realismo.js` têm ratchet por etapa** (`ETAPA_ATIVA`): cada
  critério vira gate quando sua etapa é entregue. Não afrouxe um critério já ativo.
- **`bancada/campaign-golden-update.js`** é novo e é a única forma correta de regravar
  o fixture MD3 do sandbox.
- **`AGR_ABRE` mudou de significado**: era coeficiente linear sobre `styleAgr`, virou o
  **expoente** da exposição de abertura de quem fraga. A forma antiga produzia peso
  NEGATIVO em `pick()` a partir de ganho 1,43 — o "AGR_ABRE ≈ 1,8" registrado no ciclo
  anterior era inválido. `bancada/abertura.js` guarda essa prova.
- **O Major da bancada vive em `bancada/campanha-major.js`**, compartilhado pela suíte de
  dificuldade e pelas varreduras. Não duplicar o torneio em outro script.
- **O chaveamento dos playoffs semeia pelo RESULTADO da suíça**, força só como desempate
  (`garantirPlayoffs`). Semear por força punia quem passava bem pela suíça sendo mediano.
- **`bancada/sweep.js` é o harness de varredura**: mesma seed e mesma agenda em todos os
  braços, valor restaurado mesmo após falha, braço de controle obrigatório. Toda calibração
  nova passa por ele em vez de editar `game.js` à mão.
- **`DIFICULDADE_STRICT` vale por padrão** — os quatro alvos de `dificuldade.js` são gate.

### Armadilha conhecida ao mexer em balanceamento

O cenário `repeated-overtime` do `simulation-golden.js` é **frágil por natureza**:
qualquer mudança reembaralha o RNG e a seed antiga deixa de ir para a prorrogação. A
regra, escrita no próprio arquivo, é **procurar uma seed que volte a produzir 2+
prorrogações** — nunca aceitar um placar de tempo normal, que esvaziaria o teste. O
guarda `totalRounds>=30` protege isso. A seed já foi trocada três vezes neste ciclo
(129 → 349 → 515 → 200).

### O que ficou ABERTO, com causa já medida

1. ~~Desvio intra-jogador do rating.~~ **RESOLVIDO em 28/07** — `docs/momentum-2026-07-28.md`.
   A causa era estrutural (multinomial de pesos fixos é o piso da variância), e a solução foi
   `CFG_SIM.MOM_HEAT`: reforço de urna de Pólya sobre as kills líquidas já feitas no mapa.
   Desvio de 0,167 para **0,258**. Com isso **não resta nenhum critério em relatório** em
   `bancada/perfis.js` — as quatro etapas do ratchet estão ativas.
2. ~~Duelo de abertura decidido por firepower bruto.~~ **RESOLVIDO em 27/07** —
   `docs/abertura-2026-07-27.md`. Os dois critérios viraram gate.
3. **Utilidade como recurso do round** (flash/smoke/molotov comprados e gastos, ligando
   `ut` a execução e retake). Única parte do escopo original que não entrou. O custo de
   `full` (4300) já está dimensionado para absorvê-la quando existir.
4. ~~Dificuldade abaixo do alvo.~~ **RESOLVIDO em 27/07** —
   `docs/dificuldade-invicto-2026-07-27.md`. Invicto em 4,91% [4,46–5,41] com 8.000
   campanhas. Fica o risco registrado: a margem do título sobre a borda de 25% é de
   1,3 pp, e `Favorito gap 16+` caiu para 84,8 numa faixa que termina em 82 — é o teto
   de qualquer alavanca futura que aumente zebra.

### Erros meus registrados neste ciclo (para não se repetirem)

- **Duas faixas da Etapa 1 eram invenção sem fonte** ("rounds com 0-1 kill em 8–20%" e
  "mapas apertados em 45–70%"). Foram reclassificadas em vez de o motor ser distorcido
  para acertá-las. Antes de criar uma faixa nova, exigir fonte ou rebaixá-la a relatório.
- **Promovi o critério do Spacetaker a gate por ele ter passado por um fio**, sem
  verificar a margem; caiu assim que a economia deslocou o número. Verificar margem
  antes de promover qualquer critério.
- **Bug da flag de estrela**: mover `ehEstrela` para o OVR sem notar que era chamada
  antes de o OVR existir apagou silenciosamente toda a penalidade de ego da química.
  Ao mover uma derivação, conferir a **ordem de cálculo**, não só a fórmula.

### Decisões tomadas em 27/07/2026

**O re-spin do draft já existia** — `abortarSpin` (game.js:1953) descarta o sorteio sem
gastar slot, ilimitado. A opção 1 daquela lista não era uma opção: era um fato do jogo que
o medidor ignorava. Por isso a dificuldade não é propriedade só do motor, e sim função do
esforço de draft: de **1,3%** (aceita a primeira carta) a **20,8%** (só carta de elite).

**Decisão do responsável:** o alvo de 4–6% descreve o **jogador apressado**. Quem gasta
re-spin fica acima da faixa de propósito.

A opção 2 daquela lista (restringir o Major a times fortes) foi **descartada por medição**:
tirar os times fracos torna todo adversário mais forte e **derruba** o invicto — empurra na
direção contrária. O que resolveu foi corrigir o chaveamento (que semeava por força em vez
do resultado da suíça) mais `PESO_EF` e `AMP_TIME`.

**Trabalho recomendado ao retomar** (atualizado em 28/07, depois do momentum): resta uma
única peça do escopo original — **utilidade como recurso do round**. Fora isso, a decisão é
de produto: continuar refinando fidelidade ou começar o **Modo Carreira** (P6), que depende
de schema de save e API estável, não de mais precisão. Ver o plano em
`docs/momentum-2026-07-28.md` e `docs/dados-era-rating-1-0.md` para a dívida de dados
já registrada.

Pendências anteriores que continuam válidas: a proveniência dos overrides do commit
`f731b3a` não está versionada; o corpus IFCS segue insuficiente (1/800 mapas e 1/6
eventos), portanto nenhuma nota IFCS será publicada; a distribuição entre muitas MD3
continua aberta em R3.

### Preferências de comunicação do responsável

- responder em português, com precisão, objetividade e linguagem profissional;
- assumir que o responsável não é programador e explicar termos novos em
  linguagem simples;
- priorizar resultado visível e decisão prática, evitando detalhes internos que
  não ajudem a entender ou testar o produto;
- economizar tokens sem omitir riscos, estado de validação ou próximos passos.

Para retomar em uma sessão nova:

```powershell
cd C:\Users\esteb\Desktop\Teste
git switch sandbox-test
git status -sb
# use git pull --ff-only somente se o status estiver limpo e não houver commits locais
npm ci
npm run check
```

Antes de alterar motor, simulador ou calibrador, leia `AGENTS.md`, este arquivo,
`docs/next-steps.md`, `docs/architecture.md`, `docs/testing.md` e
`docs/glossary.md`. Execute a camada de testes correspondente. Nunca comece
reescrevendo o projeto.

## 3. Visão atual do produto

O jogo principal é um roguelike/draft de Counter-Strike:

1. o usuário sorteia times históricos;
2. escolhe cinco jogadores e um treinador;
3. observa roles, playstyles, OVR, química e força efetiva;
4. disputa um Major com fase suíça e playoffs;
5. tenta concluir a campanha invicta em 9–0.

O diferencial do projeto é representar o CS profissional real por motores
explicáveis, e não apenas por uma força única arbitrária. A fidelidade é medida
por benchmarks de combate, lados, objetivos, economia, clutches, rating e
assinaturas por função.

### Princípios de produto já estabelecidos

- **Decidido:** roles, role secundário, playstyles e OVR são derivados dos
  atributos; não são etiquetas independentes colocadas sem regra.
- **Decidido:** composição, conflitos, sinergias e treinador afetam química e
  força efetiva.
- **Decidido:** a simulação deve permanecer comparável ao CS profissional real.
- **Decidido:** o jogo principal deve continuar funcionando como site estático,
  sem backend ou build obrigatório.
- **Decidido:** mobile, acessibilidade e carregamento sem CDN fazem parte do
  produto, não são acabamento opcional.
- **Recomendado:** novos modos compartilham os mesmos motores em vez de criar
  versões paralelas das fórmulas.

## 4. Arquitetura executável atual

### Entradas principais

- `index.html` carrega `style.css` e `game.js` como módulo ES.
- `game.js` contém aplicação, estado e UI e importa a composição pública; áudio
  vive em `src/application/audio.mjs`.
- `src/data`, `src/domain` e `src/public` contêm dados, motores e APIs compartilhadas.
- `sandbox.html` é a bancada visual de tuning, auditoria e calibração.
- `calibrador-worker.js` paraleliza a busca do calibrador.
- `elencos.html` é um artefato gerado a partir dos dados e motores.
- `bancada/` executa caracterização, regressão, benchmark, IFCS e E2E.
- `bancada/fidelity-score.js` calcula a nota IFCS a partir de artefatos explícitos.
- `bancada/fidelity-corpus.js` valida proveniência, cobertura e auditoria do corpus.
- `tools/extract-fidelity-demo.py` extrai demos reais offline com Awpy; não faz
  parte do jogo e passou em uma prova repetida documentada, ainda separada do
  corpus profissional.

### Pipeline de domínio

```text
ATRIBUTOS + TIMES_DEF
        |
        v
PRISMA: afinidades -> role principal/secundário -> papel de combate do IGL
        |
        v
ZÊNITE: identidade + atributos + rating -> playstyle + OVR
        |
        v
SINAPSE: elenco + cobertura + conflitos + treinador -> química/força
        |
        v
MARÉ: forma do jogador e da campanha
        |
        v
PÓLVORA + COFRE: rounds, combate, objetivo e economia
        |
        v
FALLEnANGELs: KAST, ADR, impacto, eco e rating pós-partida
```

### Fluxo de dados principal

```text
dados crus
  -> avaliação derivada de cada jogador
  -> pool visual e draft
  -> lineup do usuário
  -> química e força efetiva
  -> estado do Major
  -> simulação de mapa/série
  -> placar, estatísticas e rating
  -> progressão da campanha/interface
```

Jogo, sandbox, bancada Node e worker reutilizam motores por módulos públicos.
Nenhum deles recorta ou avalia `game.js`.

## 5. Motores e invariantes que não podem mudar por acidente

### PRISMA

- calcula afinidades contínuas por função;
- escolhe role principal e secundário;
- considera custo de realidade para pares raros;
- distribui roles no contexto do time;
- pode alterar a leitura contextual sem alterar os atributos crus.

### ZÊNITE

- deriva playstyle e OVR;
- mantém OVR de jogador entre 5 e 22;
- contém curvas, saturações, clamps e regras específicas de IGL;
- arredondamentos e ordem das operações são comportamento.

### SINAPSE

- calcula cobertura de pilares, saturação, conflitos e sinergias;
- separa química bruta e efetiva;
- treinador mitiga partes específicas das penalidades;
- Coringa mitiga conflitos de estilo, não ausência de cobertura funcional;
- força efetiva depende de força bruta, química e treinador.

### MARÉ, PÓLVORA e COFRE

- forma introduz variância competitiva;
- o simulador consome RNG em uma ordem sensível;
- combate, vantagem de homem, plant, retake, clutch e economia interagem;
- adicionar uma chamada aleatória pode mudar toda a sequência posterior.

### FALLEnANGELs

- calcula rating contextual após a partida;
- utiliza produção, sobrevivência, KAST, ADR, impacto e contexto econômico;
- a correlação e o erro contra ratings reais são contratos de benchmark.

### Calibrador

- recebe intenções de role, secundário, playstyle ou OVR;
- busca a menor alteração global capaz de satisfazer o alvo;
- distingue mudança material de dano de margem interna (`marginDamage`);
- mede colaterais fora do alvo;
- preserva intenções anteriores durante buscas posteriores;
- divide o espaço entre workers e suporta cancelamento cooperativo.

### Invariantes estruturais atuais

- 17 times e 85 jogadores;
- cinco jogadores por time;
- todos os IDs crus cobertos por `bancada/roster-snapshot.json`;
- Major com o time do usuário e 15 adversários;
- role labels canônicos: `AWPer`, `Rifler`, `Entry`, `Lurker`, `Support`, `IGL`;
- nenhuma refatoração altera pesos, thresholds, clamps, arredondamentos, dados ou
  consumo de RNG;
- `elencos.html` não é fonte de verdade e não deve receber dados manuais.

## 6. Estado atual da aba Simular

A modernização mais recente concentrou-se no sandbox. O estado publicado inclui:

- confronto de dois times e amostra round-robin dos 17 times;
- mapa único ou lotes de até 500 mapas;
- seed interna nova a cada clique em `Rodar mapa`, `Rodar lote` ou
  `Rodar amostra`;
- seed manual removida da interface;
- probabilidades dos dois times identificadas e complementares, somando 100%;
- intervalo de confiança de 95% para o lado A;
- resumo minimalista com KPR, KAST, ADR, CT win e plant;
- indicadores completos e tabelas avançadas em detalhes recolhidos;
- tabela de rating sem corte arbitrário: dez jogadores no confronto e 85 na
  amostra completa da liga;
- jogadores com amostra pequena permanecem visíveis, acompanhados da quantidade
  individual de mapas;
- suficiência mínima maior para eventos raros, rating e força do favorito;
- métricas sem amostra confiável ficam pendentes no diagnóstico legado do
  sandbox; isso não é a nota IFCS, cujo corpus insuficiente bloqueia publicação;
- rolagem pelo documento corrigida; o canvas não cria scroll aninhado;
- layout desktop e mobile sem overflow horizontal;
- times oficiais preparados uma vez por lote, sem reconstrução por mapa.

R2 acrescentou ao painel individual, sem alterar a simulação:

- função primária e secundária por jogador; para IGL, a secundária representa o
  papel de combate;
- totais de kills, deaths e assists e leitura comparável por round com K/D, KPR,
  DPR, A/R, KAST e ADR;
- amostras de rating preservadas por ID estável e mapa;
- média, mediana, desvio-padrão, P5, P95 e IC95% da média;
- extremos absolutos e faixa recorrente P10–P90, que retira os 10% mapas mais
  baixos e os 10% mais altos da leitura central;
- referência histórica, referência atual, delta, mapas e aviso de suficiência;
- busca por nome/ID, filtros por time, ambas as funções e suficiência;
- ordenação numérica por todas as métricas relevantes;
- comparação de até dois jogadores;
- exportação CSV do conjunto visível, com seed, contexto, BOM, schema estável,
  escaping e neutralização de fórmulas;
- distribuição visual em escala comum, preservando faixa P10–P90, P5–P95,
  extremos, média, mediana e referência histórica sem esconder os números;
- legenda completa, coluna explícita de comparação e ajuda estatística recolhível;
- resumo superior descrito como aderência às faixas, sem aparentar nota IFCS;
- painéis empilhados em largura integral no desktop, identidade e cabeçalho fixos,
  comparação recolhida quando vazia e jogadores convertidos em cards no celular;
- composição responsiva validada em desktop, tablet e celular, sem overflow
  horizontal da página.

O refinamento de desempenho acima foi concluído em 23 de julho de 2026.
Desvio-padrão e IC95% permanecem na comparação, na descrição acessível da
distribuição e no CSV, mas não ocupam colunas da tabela principal.

O editor de atributos também passou a ter um contrato explícito de sessão:

- controles editam um rascunho com prévia ao vivo;
- `Aplicar ao laboratório` guarda valores pelo ID cru do jogador e os propaga
  para Time, Simular e Calibrar;
- rascunhos e aplicações de vários jogadores sobrevivem à troca de seleção;
- descarte, restauração individual e reset global possuem ações separadas;
- relatório e JSON exportado registram valor original, editado e diferença;
- nomes completos, valor numérico antes do slider e largura limitada substituem
  siglas e trilhos que ocupavam todo o canvas;
- nenhuma aplicação escreve em `game.js`, `src/data` ou no navegador após
  recarregar a página.

A matemática descritiva compartilhada vive em
`src/domain/statistics/sample-summary.mjs`, recebe amostras explícitas e não
depende do DOM. A auditoria R1 e o sandbox consomem o mesmo contrato.

O redesenho visual e seu refinamento final de julho de 2026 preservaram a
auditoria profunda exatamente em SHA-256
`d9faccb428073b8191640c1a78830340b58f30d1ebdbeb91f60d0d43160bee8d` e
2.273.746 bytes. A validação integral mais recente aprovou 17/17 suítes em
180,3 s.

R3 começou com uma campanha curta MD3 separada do lote de expectativa: dois
times, mapas sem repetição, orientação alternada, forma mantida na série,
placares por mapa e golden por seed. Essa primeira fatia é independente do Major
principal e ainda não inclui repetição de muitas campanhas ou histórico.

Medição local observada após a otimização: lote de 80 mapas em aproximadamente
70 ms na máquina de desenvolvimento. Isso é uma referência operacional, não um
limite de CI.

### Baseline individual profunda — R1

**Status:** publicada no commit `b97b3d7`. A saída rápida histórica foi
preservada sem argumentos. O modo novo é explícito e não participa da regressão
rápida por padrão:

```powershell
node bancada/auditoria.js
node bancada/auditoria.js --deep
node bancada/auditoria.js --deep --format json
```

O protocolo padrão da auditoria profunda é:

- round-robin completo entre 17 elencos, com 136 confrontos por ciclo;
- oito ciclos, totalizando 1.088 mapas e 22.446 rounds na baseline registrada;
- 85/85 IDs crus, 128 mapas e os 16 elencos adversários por jogador;
- 16 exposições por jogador em cada um dos oito mapas canônicos;
- 64 exposições como lado A e 64 como lado B por jogador;
- troca de lados nos ciclos ímpares e rotação de mapa por confronto/ciclo;
- Mulberry32 reinicializado por confronto com seed derivada de uma base fixa;
- identificação por índice + ID do elenco, porque `Spirit` e `FURIA` possuem
  formações históricas distintas com o mesmo nome;
- verificação interna de cobertura, igualdade de exposição e preservação das
  classificações e atributos;
- relatório humano resumido e JSON determinístico com detalhamento por ID,
  time, mapa, role, playstyle, OVR e quartil de força do adversário.

Resultados descritivos da primeira execução aceita localmente:

| Medida | Resultado |
|---|---:|
| Pearson entre rating real e simulado | 0,943 |
| Spearman entre rating real e simulado | 0,923 |
| erro absoluto médio do rating | 0,053 |
| preservação do top 1 interno do elenco | 54,3% |
| sobreposição do top 3 interno do elenco | 79,6% |
| inversões internas de ordem | 11/167 |

Esses números são uma caracterização, não critérios de aprovação. O relatório
declara `diagnosticOnly: true` e não contém thresholds de passa/falha. Deltas,
caudas, inversões ou diferenças entre grupos não autorizam ajuste de pesos,
atributos ou fórmulas. Qualquer hipótese de balanceamento continua dependendo
do protocolo separado de `docs/next-steps.md`, comparação estatística e commit
próprio.

O JSON completo foi comparado entre duas execuções independentes e permaneceu
idêntico. No estado local após R1 passaram `npm run check`, `npm run lint`,
`npm run test:data`, `npm run test:regression` e `npm run test:benchmark`, sem
atualização de snapshot ou fixture golden.

### Variância individual no sandbox — R2

**Status:** concluída em uma sequência de commits de responsabilidade única,
sem tocar em `game.js`, `CFG_*`, dados, ordem do RNG, snapshots ou goldens.

A extração estatística foi protegida por 5.464 amostras de paridade. A auditoria
profunda R1 foi executada duas vezes após R2 e preservou exatamente SHA-256
`d9faccb428073b8191640c1a78830340b58f30d1ebdbeb91f60d0d43160bee8d` e
2.273.746 bytes. A validação integral aprovou 17/17 suítes em 201,8 s.

### Commits que contam a história recente

- `f06662a`: modernização inicial da aba Simular;
- `d490e7b`: organização das suítes por nível;
- `e34076b`: snapshot completo por ID estável;
- `724ebb9`: documentação de arquitetura, fórmulas e invariantes;
- `6a7adf9`: contrato E2E da aba Simular;
- `2b3fece`: laboratório de fidelidade mais profundo;
- `db9b7bb`: alinhamento visual com o restante do jogo;
- `437abc7`: bilateralidade, seed automática, scroll, hierarquia visual,
  suficiência estatística e otimização do lote.
- `c2be541`: contexto de profissionalização e visão do modo Carreira;
- `6148983`: E2E completo do jogo principal, publicado e aprovado na CI;
- `756aaf5`: metodologia IFCS 0–100;
- `0d04e29`: scorer puro e contratos matemáticos do IFCS;
- `8a9977b`: contrato auditável do corpus e extrator Awpy offline;
- `8932afd`: baseline técnica preliminar de 96/100 publicada;
- `d033476`: benchmark determinístico, bilateral e identificado pelos 85 IDs;
- `f9692a4`: golden completo do simulador por seed;
- `56c005b`: E2E do draft aguarda o tipo correto de card;
- `4103e52`: gerador de elencos volta a aceitar o arquivo CRLF;
- `626b7ed`: remove tiers por nome, reduz a compressão do rating com critérios
  numéricos e endurece as guardas individuais;
- `d7b3200`: lista todos os jogadores simulados no painel de desvios de rating.
- `b97b3d7`: auditoria individual profunda e determinística de R1;
- `06d2785`: aceita e detalha a fronteira entre dados crus e derivados;
- `5806a3d`, `8b9794b` e `5fbaf01`: extraem jogadores, elencos e países sob
  testes de paridade integral;
- `9fffde4` e `acb1a48`: migram o lint de elenco e o snapshot para os módulos de
  dados; o segundo remove o `new Function` próprio do snapshot.
- `2a20c0e` e `263b179`: aceitam módulos ES nativos e definem a projeção legada
  transitória dos dados;
- `e4653d7`: torna novas adições de time sincronizadas, validadas e reversíveis.
- `f57f05a` e `ace9f23`: extraem `rolePairReality` com paridade exaustiva e
  migram a análise de pares da auditoria para o módulo público.
- `d8b8480`: extrai `secondaryScore` com paridade exaustiva, sem migrar os
  consumidores clássicos.
- `9f090d8` e `8333faf`: extraem `roleStyleReality` com paridade exaustiva e
  migram a análise de estilos da auditoria para o módulo público.
- `da40f28`: extrai a matemática estatística descritiva com prova de paridade;
- `9933785`, `ddc3fa7` e `625af93`: preservam amostras individuais, apresentam
  distribuições e adicionam busca, filtros e ordenação;
- `50c8d21`: adiciona comparação lado a lado de até dois jogadores;
- `7109ed5`: exporta o diagnóstico visível em CSV seguro e rastreável.
- `ebc485e`: adiciona extremos e faixa recorrente P10–P90;
- `12c1342`: compartilha a acumulação por mapa sem alterar os lotes existentes;
- `f84d7c1`: inicia R3 com a campanha curta MD3 e golden por seed;
- `8d0b501`: transforma as distribuições individuais em uma leitura visual,
  responsiva e sem rolagem horizontal no desktop;
- `54168b2`: conclui o refinamento de hierarquia, ações, legenda, comparação,
  ajuda e responsividade intermediária.

O balanceamento deliberado está documentado em
`docs/rating-balance-2026-07-20.md`. As mudanças posteriores de tabela foram
apenas de interface e teste E2E. A política vigente de autonomia, commits e push
está em `AGENTS.md`.

## 7. Sistema de testes, CI e deploy

### Comandos

```text
npm run check             sintaxe e contrato de carregamento do sandbox
npm run lint              lint de jogo, sandbox, worker, bancada e ferramentas
npm run test:data         integridade dos dados
npm run test:regression   auditoria, snapshot, guardas históricas e golden por seed
npm run test:calibrator   calibrador, casos pesados e workers
npm run test:benchmark    realismo, assists, KDA e rating
npm run test:fidelity     contratos e scorer IFCS de fidelidade
npm run corpus:fidelity   selo e verificação do manifesto real IFCS
npm run test:e2e          jogo, calibrador e aba Simular no Chromium
npm run test:all          todas as 17 suítes
npm run validate          check + lint + todas as suítes
node bancada/auditoria.js auditoria rápida histórica de classificação
node bancada/auditoria.js --deep --format json
                           baseline individual determinística detalhada
```

O benchmark completo é deliberadamente demorado. Não reduzir amostras para
acelerar um resultado verde.

### Contratos já cobertos

- dados e IDs dos 85 jogadores;
- distribuição aprovada de roles e playstyles;
- reforma cirúrgica do drop;
- mudanças materiais versus margens internas;
- busca, custo, intenções, partições e cancelamento do calibrador;
- realismo de KPR, lados, plants, economia, pistols e clutches;
- assists e assinaturas por função;
- K/D/KAST/ADR por função;
- correlação e erro do rating;
- placar, bilateralidade, seed automática, suficiência, scroll e responsividade
  da aba Simular;
- draft, lineup, Suíça, playoffs, tela final e reinício do jogo principal;
- matemática, monotonicidade, incerteza, cobertura e caps do scorer IFCS;
- schema, hashes, mínimos, splits, auditoria determinística e holdout do corpus;
- erros de página e valores inválidos.

### CI e Pages

`.github/workflows/deploy-pages.yml` reage a pushes em `sandbox-test`:

1. checkout;
2. Node 20;
3. `npm ci`;
4. instalação do Chromium;
5. check, lint e bancada completa;
6. deploy da raiz em `gh-pages` apenas se a validação passar.

O deploy aplica cache-busting de conteúdo a `style.css` e `game.js` no
`index.html`. O sandbox é publicado como arquivo estático junto com o jogo.

## 8. Objetivo de profissionalização

Prioridades definidas pelo responsável, nesta ordem:

1. organização;
2. padronização;
3. legibilidade e manutenção;
4. compreensão por IAs e novos programadores;
5. otimização;
6. redução de dívida técnica.

### Restrições do trabalho

- não recomendar nem executar reescrita completa;
- não mudar balanceamento durante refatoração estrutural;
- não misturar comportamento novo com movimentação/renome/formatação;
- usar etapas pequenas, reversíveis e verificadas;
- criar caracterização antes de extrair um comportamento ainda invisível;
- manter o Pages funcional ao fim de cada etapa;
- preservar a experiência atual enquanto novos modos são adicionados.

## 9. Estrutura de pastas final sugerida

Esta é uma direção arquitetural, não um mandato para mover tudo cegamente de uma
vez. A autonomia de `AGENTS.md` permite avançar em fatias coerentes e verificadas:

```text
src/
  data/
    players.js
    teams.js
    coaches.js
    maps.js
  domain/
    evaluation/
      roles.js
      playstyles.js
      ovr.js
    chemistry/
    simulation/
      rng.js
      combat.js
      economy.js
      match.js
    rating/
    tournament/
    career/
  application/
    draft/
    major/
    sandbox/
    career/
  ui/
    shared/
    game/
    sandbox/
    career/
  infrastructure/
    workers/
    persistence/
    generated/
apps/
  game/
  sandbox/
  career/
tests/
  unit/
  integration/
  regression/
  benchmark/
  e2e/
docs/
  adr/
  formulas/
```

### Dependências desejadas

```text
UI -> aplicação -> domínio <- dados
 |        |
 +------> infraestrutura
```

Domínio não conhece DOM, HTML, CSS, worker ou estado global. Renderizadores não
recalculam regra de negócio. Worker e processo principal importam a mesma API.

## 10. Roadmap estrutural incremental

### Etapa P0 — preservar o baseline

**Status:** parcialmente concluída e segura. E2E, metodologia, alvo congelado,
scorer, contrato do corpus e prova do extrator estão implementados; coleta
profissional auditada e primeira baseline IFCS estão pendentes.

- manter documentação, snapshot e grupos de teste atualizados;
- manter os goldens completos por seed antes e durante a movimentação do simulador;
- manter o E2E concluído do fluxo principal: draft, lineup, Suíça e playoffs;
- separar benchmark de desempenho do benchmark de realismo.
- concluir o IFCS por etapas: adquirir/auditar o corpus profissional e gerar a
  primeira baseline sem tuning no mesmo commit.

Aceitação: nenhuma classificação, estatística ou sequência aprovada muda.

### Etapa P1 — contratos e dados crus

**Risco:** seguro a moderado.

**Status:** concluída. ADR 0002 aceito; jogadores, elencos e países são fontes
modulares únicas. Lint, snapshot, `add-team`, jogo e bancada usam essa fronteira.

- aceitar ou revisar ADR 0002;
- extrair dados crus sem extrair fórmulas no mesmo commit;
- tornar IDs explícitos obrigatórios para persistência;
- fazer gerador de elencos consumir a API pública;
- validar schemas na entrada.

Aceitação: snapshot e artefato gerado idênticos.

### Etapa P2 — módulos ES de avaliação

**Risco:** moderado.

**Status:** concluída. ADR 0004 aceito; PRISMA e ZÊNITE foram extraídos, compostos
por `src/public/evaluation-api.mjs` e consumidos por todos os caminhos.

- aceitar ou revisar ADR 0004;
- extrair primeiro funções puras de roles, secundário, playstyles e OVR;
- manter adapter legado para `game.js`, sandbox e bancada;
- remover loaders por recorte somente após todos os consumidores migrarem.

Aceitação: paridade de todos os 85 jogadores e mesmos outputs por seed.

### Etapa P3 — química e força

**Risco:** moderado.

**Status:** concluída por paridade em `src/domain/chemistry/team-chemistry.mjs`.

- isolar composição, pilares, sinergias, conflitos e treinador;
- tornar entrada/saída explícitas;
- adicionar unitários para clamps, saturações e mitigadores;
- preservar mutações contextuais de `distribuirRoles` até haver contrato puro.

Aceitação: mesmas químicas e forças para fixtures representativas e snapshot.

### Etapa P4 — RNG, simulação e rating

**Risco:** arriscado.

**Status:** concluída por paridade; RNG, forma, preparação, combate, economia,
mapa, série, telemetria e rating compõem `src/public/simulation-api.mjs`.

- injetar adapter do Mulberry32 sem mudar consumo;
- preservar os golden tests já capturados de eventos completos;
- separar forma, combate, economia, mapa e rating em commits distintos;
- medir desempenho sem alterar a distribuição estatística.

Aceitação: goldens por seed idênticos e benchmarks dentro das faixas.

### Etapa P5 — aplicação e estado

**Risco:** moderado a arriscado.

**Status:** iniciada em 29/07/2026. O domínio saiu de `game.js`; Web Audio vive em
`src/application/audio.mjs` e o progresso versionado em
`src/infrastructure/persistence/progress-store.mjs`, ambos com testes isolados.
Os templates puros vivem em `src/ui/game/`, com escaping centralizado.
Cartas, química, times, Suíça/playoffs, partida, final e Hall já usam essa
fronteira. As **889 linhas** restantes de estado, DOM e fluxo ainda podem ser
decompostas. O ciclo está num checkpoint verde e sua continuação autônoma está
autorizada; retomada e contratos exatos estão em
`docs/p5-aplicacao-ui-2026-07-29.md`.

- separar estado do draft e do Major; áudio já está isolado, e a futura carreira
  terá estado próprio;
- usar comandos/reducers pequenos sem framework obrigatório;
- tornar timers, DOM, áudio e persistência efeitos explícitos;
- impedir que renderização escreva regras de domínio.

Aceitação: E2E completo do jogo principal sem regressão visual ou funcional.

### Etapa P6 — sandbox, calibrador e workers

**Risco:** arriscado.

**Status:** parcialmente concluída. Sandbox e worker usam a API pública; a
separação interna da UI do calibrador e o loader do script inline ainda são dívida.

- fazer sandbox importar módulos públicos;
- separar UI da busca e da análise de colaterais;
- compartilhar a mesma API entre worker e thread principal;
- remover `new Function`, parsing de `<script>` e contratos por comentário.

Aceitação: intenções, Pareto, `marginDamage`, cancelamento e E2E preservados.

### Etapa P7 — padronização e dívida residual

**Risco:** seguro se fragmentado.

- nomes consistentes e exports nomeados;
- constantes e configurações centralizadas por domínio, não num arquivo global;
- erros tipados/estruturados e validação nas fronteiras;
- comentários sobre decisão, não tradução de linha;
- documentação e ADRs atualizados no mesmo commit que conclui cada migração;
- remoção de duplicação apenas depois de caracterizar os dois caminhos.

## 11. Nova visão: modo carreira de jogador

### Status da ideia

**Aberto e ainda não implementado.** A visão inicial do responsável é criar um
modo no qual o usuário cria o próprio jogador e vive uma carreira individual,
em contraste com o modo atual centrado em montar um elenco e vencer um Major.

Nome provisório: **Carreira de Jogador**.

### Fantasia central

O usuário cria uma identidade competitiva e acompanha sua transformação de
promessa em jogador profissional. Suas escolhas moldam atributos e trajetória,
mas a identidade esportiva continua sendo interpretada pelos mesmos motores do
draft9-0. O jogo deve mostrar não só “subiu de nível”, mas *como* o jogador está
mudando: role, secundário, playstyle, OVR, encaixe coletivo, forma e rating.

### Decisões recomendadas desde o início

- o jogador criado nasce como **dados crus**, não como card com resultados
  derivados gravados manualmente;
- PRISMA e ZÊNITE calculam role, role secundário, playstyle e OVR;
- SINAPSE calcula seu encaixe em cada elenco;
- MARÉ, PÓLVORA, COFRE e FALLEnANGELs simulam suas partidas e ratings;
- o modo carreira não ganha uma cópia simplificada ou incompatível dos motores;
- balanceamento de progressão fica separado do balanceamento do simulador;
- o modo atual continua disponível e não vira dependência da carreira;
- o primeiro release pode ser inteiramente local, usando persistência no
  navegador e exportação/importação de save.

### Fluxo de criação recomendado

1. identidade: nick, nome opcional, país, avatar/cor e mão dominante se isso
   tiver efeito apenas cosmético;
2. intenção: função desejada ou fantasia de jogo usada como orientação, não como
   override permanente do motor;
3. perfil inicial: distribuir um orçamento limitado entre `fp`, `en`, `tr`,
   `op`, `cl`, `sn` e `ut`;
4. prévia ao vivo: afinidades, provável role principal/secundário, playstyle e
   OVR calculados pelos motores reais;
5. validação: impedir valores fora do limite, orçamento excedido e combinações
   impossíveis;
6. confirmação: criar ID persistente próprio e iniciar a carreira.

Uma alternativa é o usuário escolher um arquétipo inicial e depois ajustar
poucos pontos. Isso reduz paralisia de escolha e produz perfis plausíveis. A
decisão entre “sliders livres”, “arquétipos” ou modelo híbrido está **aberta**.

### Loop de carreira proposto

```text
criar jogador
  -> entrar em academia/time inicial
  -> definir foco de treino e objetivo
  -> simular/jogar calendário
  -> receber minutos, estatísticas, rating e feedback
  -> evoluir atributos e reputação
  -> disputar posição, receber propostas e trocar de time
  -> jogar campeonatos e construir legado
  -> repetir por temporadas
```

### Sistemas candidatos

- criação e identidade do jogador;
- treino com escolhas e custo de oportunidade;
- forma, confiança e fadiga;
- titularidade e adequação ao elenco;
- objetivos de partida/temporada;
- calendário, campeonatos e temporadas;
- contratos, propostas e transferências;
- relação com treinador e estabilidade do time;
- reputação, conquistas e legado;
- histórico estatístico por mapa, evento, time e temporada;
- lesões somente se acrescentarem decisões interessantes e forem configuráveis;
- aposentadoria e resumo final da carreira.

Nem todos pertencem ao MVP.

### MVP recomendado

O primeiro corte deve provar a fantasia sem construir um simulador de vida:

1. criar e salvar um jogador;
2. mostrar sua avaliação real pelos motores;
3. inseri-lo num elenco controlado/selecionado;
4. simular um pequeno calendário ou uma temporada curta;
5. escolher foco de treino entre rodadas;
6. registrar estatísticas, rating e evolução;
7. concluir a temporada com um resumo e permitir continuar.

Fora do primeiro MVP: multiplayer, backend, mercado global complexo, diálogos
procedurais extensos, dezenas de ligas e reescrita do simulador.

### Progressão sem quebrar o motor

O modo carreira deve alterar os atributos crus do jogador por regras próprias de
progressão. Depois de cada alteração, todos os derivados são recalculados.

Regras recomendadas:

- treino melhora eixos específicos, não “+1 OVR” direto;
- ganhos possuem custo crescente e limite coerente;
- tempo de jogo, performance e qualidade de treino influenciam desenvolvimento;
- resultados de uma partida não devem causar saltos grandes isoladamente;
- role ou playstyle podem mudar organicamente quando afinidades cruzam margens;
- a interface deve avisar quando uma identidade está perto de mudar;
- regressão por idade/fadiga, se existir, age em atributos e tem limites claros;
- seeds e versão do save tornam resultados investigáveis;
- mudanças de progressão recebem seus próprios testes e benchmarks, separados
  das faixas de realismo do combate.

### Modelo de estado inicial sugerido

Isto é contrato conceitual, não código definitivo:

```js
{
  schemaVersion: 1,
  careerId: "uuid-ou-id-local",
  createdAt: "ISO-8601",
  player: {
    id: "career:...",
    identity: { nick, name, country, visual },
    rawAttributes: { fp, en, tr, op, cl, sn, ut, rating, isIGL },
    development: { age, potential, trainingFocus, fatigue, confidence }
  },
  context: {
    season,
    date,
    teamId,
    contract,
    reputation,
    objectives
  },
  history: {
    teams: [],
    matches: [],
    seasons: [],
    achievements: []
  },
  rng: { algorithmVersion, seed, state }
}
```

Não persistir como fonte de verdade: role, secundário, playstyle, OVR, química,
força efetiva e rating de cada partida. Esses valores podem aparecer em
snapshots históricos, acompanhados da versão do motor, mas o estado atual deve
ser derivado.

### Persistência

**Recomendado:** adapter versionado com:

- `localStorage` ou IndexedDB atrás de uma interface pequena;
- autosave atômico em pontos seguros;
- slots manuais;
- exportação/importação JSON;
- `schemaVersion` e migrações explícitas;
- validação completa antes de carregar;
- backup do save anterior antes de migrar;
- nenhuma função de domínio lendo diretamente o navegador.

### Arquitetura do modo carreira

```text
src/domain/career/
  progression.js
  training.js
  contracts.js
  season.js
  objectives.js

src/application/career/
  create-career.js
  career-store.js
  career-commands.js
  career-view-model.js

src/infrastructure/persistence/
  career-save.js
  career-migrations.js

src/ui/career/
  creator.js
  dashboard.js
  matchday.js
  history.js
```

Esses diretórios só devem nascer quando a primeira fatia vertical precisar
deles. Não criar árvore vazia nem mover o repositório inteiro antes do protótipo.

### Testes necessários para a carreira

- unitários de orçamento e validação do criador;
- paridade do jogador criado com PRISMA/ZÊNITE;
- unitários de progressão, treino, limites e transições de identidade;
- serialização, carregamento, corrupção e migração de save;
- integração carreira -> elenco -> química -> simulação -> rating;
- determinismo por seed em uma temporada curta;
- E2E: criar jogador, salvar, recarregar, simular, treinar e continuar;
- acessibilidade do criador e dashboard;
- benchmark para saves longos e históricos grandes;
- teste que prove que o modo carreira não altera o snapshot do elenco histórico.

### Fases seguras de implementação

#### C0 — descoberta e ADR

- fechar fantasia, escopo do MVP e decisões abertas;
- escrever ADR do modo carreira e contrato de persistência;
- desenhar wireflow simples;
- nenhuma mudança de comportamento.

#### C1 — API de avaliação estável

- extrair/encapsular avaliação de um jogador sem DOM;
- receber atributos crus e retornar derivados;
- cobrir com jogadores históricos e sintéticos.

#### C2 — estado e save

- definir schema versionado;
- implementar reducer/comandos puros;
- adapter local de save e import/export;
- ainda sem temporada completa.

#### C3 — criador de jogador

- entregar uma página ou rota experimental isolada;
- orçamento, arquétipos/sliders e prévia real dos motores;
- criar, salvar, recarregar e excluir carreira com confirmação.

#### C4 — primeira temporada vertical

- inserir jogador num elenco controlado;
- calendário curto, simulação, estatísticas e rating;
- treino entre partidas e resumo de temporada.

#### C5 — profundidade de carreira

- contratos, propostas, disputa por posição, reputação e objetivos;
- histórico multi-temporada;
- balanceamento próprio, em commits separados.

#### C6 — acabamento

- narrativa, conquistas, sons, responsividade, acessibilidade e desempenho;
- telemetria apenas se houver decisão explícita de privacidade e infraestrutura.

### Quando começar

**Recomendação atual:** não implementar a carreira inteira dentro do monólito.
Também não é necessário esperar toda a profissionalização terminar. O melhor
ponto é depois de existir:

1. contrato E2E do fluxo principal (**cumprido**);
2. API estável e testada para avaliar um jogador a partir de atributos crus;
3. adapter de RNG injetável ou pelo menos goldens suficientes;
4. contrato versionado de persistência.

Nesse momento, C2/C3 podem avançar como fatia isolada enquanto o restante do
monólito continua sendo extraído gradualmente.

## 12. Decisões abertas para o responsável

Não presumir respostas sem conversar:

1. A carreira começa em academia, time fraco, seletiva ou escolha livre?
2. O usuário controla somente treino/decisões ou também ações durante partidas?
3. O jogador escolhe uma role desejada, um arquétipo ou distribui tudo livremente?
4. O mundo usa apenas os 17 times históricos atuais ou temporadas fictícias?
5. Times e jogadores envelhecem/evoluem junto com o protagonista?
6. A carreira tem fim obrigatório, aposentadoria opcional ou modo infinito?
7. Contratos e transferências devem ser centrais ou leves?
8. Existe dificuldade? Ela afeta progressão, decisões adversárias ou ambos?
9. Saves serão exclusivamente locais no primeiro momento?
10. A experiência vive dentro do `index.html` ou começa numa entrada
    experimental separada como `career.html`?
11. Qual deve ser a faixa de OVR inicial e o ritmo desejado de progressão?
12. Falha esportiva pode encerrar a carreira ou sempre há recuperação?

## 13. Frentes atuais ao retomar

`docs/next-steps.md` preserva o plano histórico que originou R1–R6/P1–P6; os
handoffs especializados mais novos definem a retomada operacional atual:

1. **cartas, produto visual:** o jogo continua no Tactical Editorial publicado;
   a proposta de seis faixas e retratos está somente em `#proposta`. O
   enquadramento A refinado e a referência anterior estão lado a lado para a
   conferência final; depois vêm os outros cinco retratos da Spirit, antes de
   qualquer promoção. Fonte: `docs/cartas-design-2026-07-28.md` §12;
2. **P5, estrutura:** separar somente criação/reset de `S`, `TG`, `MP` e `MATCH`,
   preservando forma, identidade e quirks. Fonte:
   `docs/p5-aplicacao-ui-2026-07-29.md` §11;
3. **IFCS:** o corpus profissional continua parcial; não existe nota oficial;
4. **Carreira de Jogador:** permanece uma frente posterior, dependente das
   decisões de produto abertas e de estado/save próprios.

R1–R6 e P2 são contexto histórico, não uma fila ainda por executar. O domínio e
os dados de `game.js` já foram removidos; novas adições entram pelos módulos crus.
Cada frente deve manter responsabilidade verificável e nunca misturar interface,
refatoração, dados e balanceamento no mesmo commit.

## 14. Dívidas e riscos conhecidos

- `game.js` e `sandbox.html` ainda concentram estado e responsabilidades de UI;
- o loader do calibrador ainda avalia o script inline de `sandbox.html`; jogo,
  bancada e worker já não dependem de loaders por texto;
- estado global mistura domínio, aplicação e efeitos;
- não existe ainda persistência versionada adequada para uma carreira;
- goldens completos do simulador por seed existem; qualquer mudança deliberada
  exige explicação estatística antes da atualização do fixture;
- o scorer e o contrato de corpus IFCS existem; o alvo de 22/01/2026 a
  07/07/2026 está congelado e o extrator foi provado com uma demo real, mas
  ainda faltam adquirir, extrair e auditar os dados profissionais antes da nota;
- configurações ainda vivem próximas de dados e implementação;
- `elencos.html` pode divergir se não for regenerado;
- alterações no RNG produzem regressões amplas e difíceis de diagnosticar;
- histórico ilimitado de carreira pode crescer demais no navegador;
- evolução do protagonista pode quebrar fidelidade se alterar outputs derivados
  diretamente ou reutilizar thresholds do combate como regras de progressão;
- um modo novo dentro do monólito aumentaria muito a dívida antes das extrações
  mínimas recomendadas.

## 15. O que deve permanecer como está por enquanto

- funcionamento estático e sem framework obrigatório;
- branch `sandbox-test` como área de trabalho;
- `main` intocável até decisão explícita;
- motores, pesos e faixas atuais;
- labels canônicos de roles e IDs de playstyle;
- Mulberry32 e ordem atual de consumo do RNG;
- snapshot completo por ID cru;
- suíte estatística com tamanho real;
- deploy condicionado à validação;
- sandbox como ferramenta de diagnóstico que não aplica mudanças sozinho;
- modo draft/Major como experiência existente, mesmo após nascer a carreira.

## 16. Regras para qualquer IA futura

- leia `AGENTS.md` e este documento antes de editar;
- verifique branch, status e mudanças do usuário;
- escolha e execute a próxima fatia segura sem pedir nova permissão para cada
  etapa; commits e push para `sandbox-test` seguem a autorização de `AGENTS.md`;
- não trate recomendações deste arquivo como comportamento já implementado;
- não invente resposta para decisões marcadas como abertas;
- não proponha reescrita completa;
- não altere balanceamento para facilitar refatoração ou teste;
- não reduza benchmark para ganhar tempo;
- não chame o diagnóstico legado do sandbox de nota IFCS;
- não publique nota IFCS sem corpus real auditado, cobertura e intervalo;
- não atualize snapshot para esconder regressão;
- não persista derivados como fonte de verdade da carreira;
- não crie um segundo conjunto de fórmulas para o jogador criado;
- explique claramente qualquer mudança no RNG, save ou schema;
- mantenha commits pequenos e dê ao responsável uma forma concreta de testar.

## 17. Critério de sucesso de longo prazo

O projeto estará profissionalizado quando:

- dados, domínio, aplicação, UI e infraestrutura tiverem fronteiras claras;
- browser, Node e worker importarem os mesmos módulos públicos;
- o jogo principal e a carreira tiverem E2E completos;
- fórmulas e configurações forem localizáveis e documentadas;
- saves forem versionados, validáveis e migráveis;
- um novo programador ou IA conseguir localizar uma regra sem vasculhar HTML;
- otimizações forem medidas sem mudar a distribuição esportiva;
- o draft/Major continuar estável;
- o modo Carreira de Jogador usar os motores reais e oferecer uma progressão
  legível, investigável e divertida por várias temporadas.

## 18. Resumo em uma frase

Preservar o simulador fiel e o draft atual, modularizar por paridade e, sobre
essa base, criar uma carreira em que o usuário desenvolve um jogador próprio
cujos atributos são interpretados pelos mesmos motores de identidade, equipe e
partida do draft9-0.
