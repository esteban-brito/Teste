# Identidade única: o playstyle — 26 de julho de 2026

> Etapa 2 do ciclo de fidelidade. **É balanceamento**, não refatoração: agressão e
> afinidade de lado mudam de fonte, então a timeline do simulador muda. Commit
> separado, com comparação antes/depois e justificativa de cada âncora atualizada.

## 1. O problema

O jogador tinha **duas identidades paralelas**:

- o **playstyle** (10 receitas), que decide OVR, química e realidade função×estilo;
- o **sub-arquétipo** (`SUBARQ`), que decidia o rótulo da carta, a agressão de combate
  (`subAgr`) e a afinidade de lado (`ladoFitRaw`).

O sub era escolhido em boa parte pelo próprio playstyle, via `SUB_BY_STYLE` — ou seja,
não acrescentava informação, apenas a traduzia para um vocabulário mais pobre (2 a 3
buckets por função contra 10 playstyles). O resultado prático era contradição na carta:

| Playstyle | Sub-arquétipo exibido |
|---|---|
| Playmaker | AWP Agressiva (6 jogadores), Fragger (4), Spacetaker (2) |
| Âncora | **Pop-flasher (5)**, Conector (1), Âncora (1) |
| Cerebral | **Pop-flasher (5)**, Mid-rounder (1), Âncora (1) |
| Facilitador | Pop-flasher (5), Conector (2) |
| Trader | AWP Reativa (2), Conector (2), Refrag (3), Playmaker (1) |

O m0NESY, um **Playmaker**, aparecia como "AWP Agressiva". Um **Âncora** aparecia como
"Pop-flasher". A carta dizia uma coisa e o motor de OVR/química usava outra.

## 2. O que foi feito

Removidos: `SUBARQ`, `SUB_CONTRA`, `SUB_BY_STYLE`, `SUB_CORINGA`, `subArquetipo`,
`ehCoringa`, `CFG_AVALIACAO.CORINGA_PISO/CORINGA_SPREAD`, `ESTEIRA` e os campos
`sub`/`esteira` do jogador avaliado.

Substituições, todas lendo `PLAYSTYLES[id].traits`, que **já existia** e já era
consumido pela química:

| Antes | Depois |
|---|---|
| `subAgr` = `sub.agr` × (`sub.eixo`/`SUB_INT`) | `styleAgr` = `traits.pace` × clareza do estilo × `STYLE_AGR` |
| `ladoFitRaw` somava `sub.lado` | soma `traits.ct`/`traits.t` escalados por `STYLE_LADO` |
| verso da carta = `sub.nome` + `sub.stats` | `STYLE_LABEL(playstyle)` + as 4 stats da receita do estilo |
| detecção de Coringa por `ehCoringa` | `jokerProfile`, dentro de `styleMatch` — regra única |

A "clareza" do estilo (`styleClareza`) reaproveita a margem que `styleMatch` já calcula
para o 2º colocado, com o mesmo piso de 0,35 do `eixo` antigo: identidade difusa continua
contando, só conta menos.

### Escalas — escolhidas por medição, não por gosto

As escalas foram calibradas sobre os 85 jogadores para **preservar o desvio-padrão** do
efeito anterior. Só a fonte da identidade muda; a magnitude dela não:

| Componente | sd antes (sub) | sd depois (traits) | escala aplicada |
|---|---|---|---|
| agressão | 0,363 | 0,249 | `STYLE_AGR` = 1,4 |
| lado CT | 2,049 | 0,346 | `STYLE_LADO.ct` = 5,9 |
| lado T | 1,852 | 0,360 | `STYLE_LADO.t` = 5,2 |

A média não precisa ser preservada porque `LADO_MEAN` zero-centra a afinidade de lado
sobre a população — só a dispersão tem efeito.

A direção de lado (CT vs T) é preservada em **60 dos 85 jogadores**. Os 25 que invertem
são justamente os casos em que o sub contradizia o playstyle.

### Extração pura

A identidade foi extraída para `src/domain/evaluation/style-identity.mjs`, com paridade
integral provada pelo checador diferencial histórico
`check-style-identity-parity.js` (178 comparações, aposentado com o legado, incluindo
entradas nulas, estilos desconhecidos e rótulos legados). `exposure-profile.mjs` passou a
consumi-la em vez de reimplementar a agressão do sub.

## 3. Efeito medido

### Não mudou (o que tinha de ficar igual)

- **Snapshot idêntico**: os 85 jogadores mantêm função, função secundária, playstyle e OVR.
  A classificação não se moveu — só a identidade de combate mudou de fonte.
- Todas as 12 métricas macro de `realismo.js` seguem na faixa. KPR **0,694** nos dois lados.
- `kda.js` verde em todas as checagens.

### Melhorou

| Medida | Antes | Depois |
|---|---|---|
| Rating: correlação r | 0,955 | **0,960** |
| Rating: erro médio | 0,050 | **0,045** |
| Sobreposição entre bandas de OVR | 16,4% | 17,7% |
| r² do OVR sobre a média do jogador | 0,602 | 0,573 |

### Assinatura por estilo — na direção certa

- **Âncora**: DPR 0,66 → 0,63 e rating 1,058 → 1,084. Morre menos e rende mais, que é o
  comportamento de quem segura bombsite.
- **Spacetaker**: DPR 0,67 → 0,70. Morre mais, coerente com um estilo de tomar espaço.
- **AWPer − Support** em KPR: 0,170 → 0,123. A separação continua acima do mínimo (0,06),
  mas encolheu — o sub dava ao AWPer um empurrão de agressão que o playstyle não confirma.

### Continua fora do alvo (é trabalho das próximas etapas)

- peso do contexto 44,5% → 45,0% (alvo 70–88) — depende da Etapa 3;
- desvio intra-jogador 0,169, inalterado — depende da Etapa 3;
- Entry ainda não lidera opening kills (0,117 → 0,119);
- Spacetaker ainda abre abaixo da média.

### Regressão de dificuldade a registrar

Invicto na faixa alta caiu de **3,1% para 1,3%**, com o título praticamente igual
(20,1% → 20,0%). Ou seja: o jogador ganha o Major com a mesma frequência, mas perde mais
mapas no caminho. É consequência de mapas mais competitivos, e será tratado no fechamento
— a suíte de dificuldade segue em modo relatório justamente por isso.

## 4. Âncoras atualizadas — uma a uma

O `simulation-golden.js` guarda âncoras codificadas que impedem `--update` silencioso.
Cada uma foi revisada conscientemente:

1. **`economy-and-clutches`** (seed 1, NAVI × Outsiders, Nuke): 7-13 → **10-13**.
   Deslocamento esperado de timeline; o cenário continua cobrindo economia e clutches.
2. **`repeated-overtime`** (Nuke): a seed 129 **deixou de produzir prorrogação** (virou
   13-5). Trocar só o placar teria esvaziado o cenário, que existe para cobrir o OT
   repetível. A seed foi trocada para **349**, que reproduz o mesmo **22-18 em 40 rounds**
   — três prorrogações —, preservando a cobertura original.
3. **`campaign-best-of-three`** (seed 9): 2-0 em Nuke,Inferno → **1-2 em Nuke,Train,Dust2**.
   A cobertura **aumenta**: três mapas exercitam o mapa decisivo, que a varrida 2-0 nunca
   alcançava.
4. **`campaign-golden.json`** (campanha MD3 do sandbox, seed 424242): segue 2-1 em três
   mapas, com placares novos. Regenerado por `bancada/ferramentas/campaign-golden-update.js`, criado
   nesta etapa — antes esse fixture só podia ser editado à mão.

## 5. Validação

22/22 suítes verdes (`npm run validate`), incluindo os três E2E. `npm run check` cobre a
nova paridade de identidade. `elencos.html` regenerado por `bancada/ferramentas/roster.js`; a coluna
que mostrava o sub-arquétipo passou a mostrar o playstyle (chave `ps`).

Verificação manual: abrir `index.html`, sortear e virar a carta do m0NESY — lê
**Playmaker**.
