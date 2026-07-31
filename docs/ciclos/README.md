# Ciclos encerrados — evidência, não guia

Os documentos desta pasta são **relatórios de ciclos que já terminaram**. Eles
respondem *"por que este número é este"*, não *"o que eu faço agora"*.

Para saber o que fazer agora, leia `AGENTS.md` e `docs/retomada-2026-07-31.md`.
Nenhum arquivo daqui é ponto de retomada.

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
`bancada/r5-comparison.js` e continua em `docs/r5-experiment.json`.

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

## Auditorias e passadas isoladas

| Arquivo | Assunto |
|---|---|
| `rating-balance-2026-07-20.md` | recalibração do desempenho individual |
| `role-fidelity-audit-2026-07-23.md` | R4.1 e R4.2 — identidade individual |
| `quality-pass-2026-07-24.md` | varredura de bugs, performance e lixo |
