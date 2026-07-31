# Campanha invicta — do instrumento cego ao alvo de 4–6%

> Ciclo de 27 de julho de 2026. Três commits: instrumento, fidelidade do medidor e
> balanceamento.

## 1. O instrumento era cego

`bancada/dificuldade.js` media a campanha invicta com **300 campanhas**. Com o evento perto
de 5%, um único acerto vale 0,33 pp e não havia intervalo nenhum. As três medições
registradas do **mesmo estado** — 0,7%, 1,1% e 1,5% — eram ruído, não movimento.

Amostra necessária, com o erro-padrão `sqrt(p(1−p)/n)` em p≈0,05:

| n | erro-padrão | IC95% |
|---|---|---|
| 300 | 1,26 pp | ±2,5 pp — não distingue 1,5% de 4% |
| 1.000 | 0,69 pp | ±1,35 pp |
| **3.000** | **0,40 pp** | **±0,78 pp** |

Entraram `src/domain/statistics/proportion-interval.mjs` (intervalo de **Wilson**, que ao
contrário do normal simples não escapa de [0,1] nem subestima a incerteza quando o evento é
raro) e `bancada/sweep.js` (varredura pareada versionada, com braço de controle que prova que
nenhum estado atravessa braços). Antes deste ciclo as varreduras eram feitas editando
`game.js` à mão e não ficavam no repositório.

## 2. O medidor media um jogo que não existe

Quatro divergências contra a UI, todas verificáveis:

| divergência | o que a UI faz | efeito isolado no invicto |
|---|---|---|
| draft sem re-spin | `abortarSpin` descarta o sorteio sem gastar slot, ilimitado (game.js:1953) | governa tudo — ver §3 |
| nick repetido aceito | bloqueia jogador repetido por nick (game.js:2162) | −0,5 pp |
| sem `distribuirRoles` | `montarMeuTime` redistribui funções antes da força (game.js:2284) | +0,2 pp |
| Major sem exclusão | remove o NPC de maior sobreposição (game.js:2296-2300) | ~0 |

As três últimas quase se cancelam. **A que importava era o re-spin.**

## 3. A dificuldade é função do esforço de draft

Com o re-spin modelado por um limiar de OVR — um número, sem nick, sem time, sem exceção —
e 3.000 campanhas por ponto:

| esforço | giros | força | invicto | título |
|---|---|---|---|---|
| aceita a primeira carta | 6,1 | 90,6 | 1,3% [0,9–1,7] | 17,0% |
| só top 46% (OVR≥18) | 8,1 | 95,3 | 3,1% [2,5–3,8] | 26,7% |
| só top 33% (OVR≥19) | 8,6 | 95,6 | 3,2% [2,7–3,9] | 31,6% |
| só top 20% (OVR≥20) | 10,0 | 95,2 | 4,5% [3,8–5,3] | 35,7% |
| só top 11% (OVR≥21) | 21,0 | 99,0 | 11,7% | 52,3% |

**Decisão do responsável:** o alvo de 4–6% descreve o **jogador apressado** (limiar 0). Quem
gasta re-spin fica acima da faixa de propósito — o esforço é recompensado.

## 4. Diagnóstico antes de tocar em constante

3.000 campanhas, jogador apressado:

- disputa **9,8 mapas** por campanha e vence **61,0%** deles;
- ganha o título em **14,9%** das campanhas;
- apenas **8,1% dos títulos** vêm sem derrota.

Com p=0,61 em ~10 mapas independentes, o invicto seria 0,7%; o observado de 1,2% já embutia a
correlação da forma de campanha. Para chegar a 5% é preciso p perto de **0,68**, ou mais
correlação dentro da campanha.

## 5. As três mudanças

**(a) Chaveamento por resultado — correção de fidelidade, não balanceamento.**
`garantirPlayoffs` semeava o top-8 por **força efetiva**. Num Major real o chaveamento sai do
resultado da suíça: 3-0 é cabeça de chave, 3-2 pega os melhores. Semear por força punia
sistematicamente quem passou bem pela suíça sendo mediano — exatamente o caso do elenco
draftado. Agora: menos derrotas primeiro, força só como desempate.
Efeito isolado: título 14,9% → 18,2%, invicto 1,2% → 1,9%, vitória por mapa 61,0% → 62,3%.

**(b) `PESO_EF` 0,60 → 0,40.** Quanto do mapa é decidido pela força do **time** (OVR, química,
treinador) contra a **skill individual** crua. O elenco draftado é uma coleção de estrelas com
coesão mediana: pesar mais o indivíduo é o que o torna competitivo contra times de fábrica de
ef 98–103.

**(c) `AMP_TIME` 0,11 → 0,22.** Desvio da forma **coletiva** de campanha, sorteada uma vez por
Major. `P(invicto) = E[p^n]` é convexa em p, então a cauda cresce com a variância entre
campanhas; a 0,11 o Major era previsível demais para alguém passar ileso por dez mapas.
Continua abaixo da amplitude individual do role player (0,23).

### Por que as três, e não uma

Nenhuma alavanca isolada chega à faixa (1.500–4.000 campanhas por braço):

| alavanca isolada | melhor invicto alcançado |
|---|---|
| `PESO_EF` até 0,38 | 3,6% |
| `AMP_TIME` até 0,36 | 3,1% |
| `D_MAPA` até 65 | 2,9% |

Varredura 2D de `PESO_EF` × `AMP_TIME` em grade mostrou que o par (0,40 · 0,22) é o ponto que
entra no meio da faixa sem estourar guarda.

## 6. Resultado, com margem em três amostras

| n | invicto | título |
|---|---|---|
| 2.000 | 5,70% [4,77–6,80] | 26,65% [24,76–28,63] |
| 4.000 | 5,13% [4,48–5,85] | 26,75% [25,40–28,14] |
| **8.000** | **4,91% [4,46–5,41]** | **26,27% [25,32–27,25]** |

`DIFICULDADE_STRICT` passa a valer por padrão: os quatro alvos da suíte viraram gate.

**Risco registrado:** a margem do título sobre a borda de 25% é fina (1,3 pp). Uma mudança
futura que empurre o título para baixo reprova a suíte antes de o invicto sair da faixa.

## 7. Guardas preservadas

`bancada/realismo.js`, 45.900 mapas: **12/12 macro e 6/6 forma**.

| guarda | antes | depois | faixa |
|---|---|---|---|
| Favorito gap 16+ | 86,8 | **84,8** | 82–93 |
| Favorito gap 0-3 | 52,6 | 53,2 | 50–58 |
| KPR global | 0,668 | 0,666 | 0,66–0,78 |
| CT-round win | 50,8 | 50,7 | 47–54 |
| Abertura vencida pelo CT | 47,3 | 47,3 | 46–56 |

**`Favorito gap 16+` é o teto real desta calibração**: sobraram 2,8 pp até a borda inferior.
Qualquer alavanca que aumente zebra consome essa folga.

Validação integral: `npm run validate`, **24/24 suítes**, sem reduzir amostra ou limite.
