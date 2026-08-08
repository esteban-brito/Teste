# Ciclos encerrados — evidência, não guia

Os documentos desta pasta são **relatórios de ciclos que já terminaram**. Eles
respondem *"por que este número é este"*, não *"o que eu faço agora"*.

Para saber o que fazer agora, leia `AGENTS.md` e `docs/retomada-2026-08-05.md`.
Nenhum arquivo daqui é ponto de retomada — **inclusive os handoffs de 31/07 e de
04/08/2026**, que chegaram aqui depois de serem ultrapassados. Esta linha já
apontou para um deles: ponteiro de índice envelhece igual a documento.

Eles foram separados em 31/07/2026 porque `docs/` tinha 39 arquivos num diretório
plano: guia operacional e evidência histórica disputavam o mesmo espaço, e uma
sessão nova não conseguia distinguir os dois sem abrir cada um. Ficaram na raiz de
`docs/` apenas os documentos que orientam trabalho novo.

**Nada aqui perdeu validade.** Um relatório de balanceamento continua sendo a
justificativa executável de uma constante do motor; mudar essa constante sem ler o
relatório correspondente é desfazer trabalho medido. `docs/ciclos/r5-plan.md`
continua sendo o plano mestre que explica a arquitetura do experimento R5.

## Ciclo R5/R6 — fidelidade tática e caudas individuais (23/07/2026)

| Arquivo | Assunto |
|---|---|
| `r5-plan.md` | plano mestre e arquitetura do experimento |
| `r5-tail-balance-2026-07-23.md` | R5.2 — caudas sem pisos ou tetos duros |
| `r5-structural-extraction-2026-07-23.md` | R5.4 — fronteiras puras de combate e rating |
| `r5-effective-role-balance-2026-07-23.md` | R5.5 — função efetiva de combate do IGL |
| `r5-exposure-balance-2026-07-23.md` | R5.6a — exposição contextual |
| `r5-save-balance-2026-07-23.md` | R5.6b — save por valor abstrato dos sobreviventes |
| `r5-trade-balance-2026-07-23.md` | R5.7a — oportunidade contextual de trade |
| `r5-assist-balance-2026-07-23.md` | R5.7b — oportunidade contextual de assistência |
| `r5-rating-audit-2026-07-23.md` | R5.8 — auditoria do rating pós-eventos |
| `r6-closure-2026-07-23.md` | R6 — fechamento e validação do ciclo |

O manifesto executável do experimento **não** está aqui: ele é consumido por
`bancada/suites/r5-comparison.js` e continua em `docs/dados/r5-experiment.json`.

## Ciclo de fidelidade da simulação (26–28/07/2026)

| Arquivo | Assunto |
|---|---|
| `baseline-simulacao-2026-07-26.md` | retrato de referência antes do ciclo |
| `identidade-playstyle-2026-07-26.md` | Etapa 2 — o playstyle como identidade única |
| `rating-da-carta-2026-07-26.md` | Etapa 3 — o rating histórico entra uma vez, no OVR |
| `relogio-do-round-2026-07-26.md` | Etapa 4 — o round ganha tempo real |
| `economia-real-2026-07-26.md` | Etapa 5 — economia e arsenal por jogador |
| `fechamento-dificuldade-2026-07-27.md` | correção da flag de estrela e fechamento |
| `abertura-2026-07-27.md` | quem abre o round é quem se expõe |
| `dificuldade-invicto-2026-07-27.md` | campanha invicta até a faixa de 4–6% |
| `momentum-2026-07-28.md` | momentum intra-mapa; fecha o critério `distribuicao` |
| `utilitaria-2026-07-28.md` | utilitária como recurso do round |
| `receitas-padronizadas-2026-07-28.md` | receitas de playstyle padronizadas |

## Ciclo P2 — modularização por paridade (28/07/2026)

| Arquivo | Assunto |
|---|---|
| `p2-modularizacao-2026-07-28.md` | relatório final: o que saiu de `game.js`, os contratos descobertos, a prova de consumo de RNG e as armadilhas |

Ele chegou aqui em 03/08/2026, vindo da raiz de `docs/`. O ciclo está encerrado —
`docs/next-steps.md` o declara **CONCLUÍDO** —, então o lugar dele é entre as
evidências. Isso **não** o rebaixa: `AGENTS.md` continua mandando lê-lo antes de
alterar os módulos extraídos, exatamente como manda ler o relatório que produziu
uma constante antes de mexer nela.

## Ciclo da camada tática (04–05/08/2026)

| Arquivo | Assunto |
|---|---|
| `tatica-baseline-2026-08-04.md` | retrato de referência com a camada construída e DESLIGADA; quais eixos não podem render duas vezes |
| `tatica-tipo-de-jogada-2026-08-05.md` | `CFG_TATICA.ATIVA` em 1 — seis tipos de jogada, anti-strat e o canal que deixou de ser adivinhar. **Leia antes de tocar em qualquer constante da camada** |

A exibição passiva que esse ciclo deixou em aberto foi **recusada** pelo
responsável em 05/08, com implementação pronta e verde na mesa. O motivo está na
emenda da §11-bis de `docs/project-context.md`.

## Ciclos visuais

| Arquivo | Assunto |
|---|---|
| `monograma-e-suica-2026-08-05.md` | monograma da carta — três defeitos simultâneos e zero guarda — e a Fase Suíça que, por aritmética do formato, nunca enchia a tela |

## Handoffs superados

| Arquivo | Assunto |
|---|---|
| `retomada-2026-07-31.md` | handoff geral entre 31/07 e 04/08/2026 — fechamento do ciclo visual das cartas e o caminho até ele, inclusive direções tentadas e descartadas |
| `retomada-2026-08-04.md` | handoff geral de 04/08 — superado no dia seguinte, quando a camada tática entrou em jogo |

Um handoff superado é evidência como qualquer outra: ele registra por que a carta
é o que é e o que já foi tentado. O que ele **não** pode continuar sendo é o
arquivo que uma sessão nova abre para saber o que fazer — por isso saiu da raiz.
O cabeçalho dele lista o que envelheceu.

## Auditorias e passadas isoladas

| Arquivo | Assunto |
|---|---|
| `rating-balance-2026-07-20.md` | recalibração do desempenho individual |
| `role-fidelity-audit-2026-07-23.md` | R4.1 e R4.2 — identidade individual |
| `quality-pass-2026-07-24.md` | varredura de bugs, performance e lixo |
