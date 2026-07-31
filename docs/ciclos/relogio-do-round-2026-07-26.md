# O round ganha tempo — 26 de julho de 2026

> Etapa 4 do ciclo de fidelidade. **É balanceamento**, e o mais invasivo do ciclo: muda a
> estrutura do round e, com ela, toda a timeline do simulador.

## 1. O problema

O laço de `combateRound` **só avançava quando alguém morria**. O contador de tempo (`tempo++`)
ficava depois do duelo, então cada tique de relógio custava uma baixa. Consequências
estruturais, não de calibração:

- **0,0% dos rounds tinham 0 ou 1 kill.** Round quieto, default sem contato e perda de
  relógio sem baixa eram impossíveis por construção.
- **58,3% dos rounds terminavam com 8 ou 9 kills** — vencedor com 1 ou 2 sobreviventes. A
  distribuição era uma barra dupla com vale em 3, 5 e 7, quando o CS real tem uma curva
  contínua. A média (6,94 kills/round) batia o KPR real, e por isso o erro passava
  despercebido por qualquer faixa de média.
- Para segurar o KPR nessa estrutura foi preciso inventar `CLOSE_MEN`: um sorteio que
  encerrava o round por vantagem de homem. Ele existia só para compensar a falta de relógio.

## 2. O que foi feito

O round passou a rodar sobre um **relógio real**: 115 s de round e 40 s de bomba, em tiques
de 5 s. O duelo virou um **evento sobre o relógio**, não o próprio avanço do round.

A cada tique decide-se se há **contato**. A chance vem de:

```
pContato = CONTATO_BASE × ritmo × (pós-plant ? CONTATO_POS : 1) × (1 − CONTATO_DESV × desvantagem)
```

- **`ritmo`** é sorteado **uma vez por round**, a partir da agressão coletiva do lado T —
  que é quem dita o tempo no CS. Composição agressiva executa cedo; composição posicional
  joga default. É daí que nascem os rounds quietos: um número por round, não por duelo.
- **`CONTATO_DESV`**: quem está em desvantagem evita o contato e joga o relógio. É isto que
  fecha rounds sem duelar até o último homem — e o que permitiu **remover `CLOSE_MEN`**.
- Objetivo (plant, defuse, save, detonação) corre com o relógio, **tenha havido contato ou
  não**.

Removidos: `CLOSE_MEN`, `RND_TEMPO`, `PP_TEMPO`. Introduzidos: `RND_SEGUNDOS`,
`BOMBA_SEGUNDOS`, `TICK`, `CONTATO_*`. `PLANT_*` e `DEFUSE_*` passaram de "por duelo" para
"por tique" e foram recalibrados.

Também foram extraídos para configuração dois números mágicos que estavam embutidos em
`formaDoDia` (`FORMA_PISO_BASE`, `FORMA_PISO_AMORT`), sem alterar seus valores.

### Calibração

Todas as constantes novas saíram de varredura contra as faixas reais, não de estimativa:

| Constante | Valor | Como foi escolhida |
|---|---|---|
| `CONTATO_BASE` | 0,42 | varredura 0,26–0,42 contra o KPR |
| `CONTATO_RITMO` | 0,60 | varredura 0,45–0,75; controla rounds quietos vs. frenéticos |
| `CONTATO_MIN` | 0,08 | piso do ritmo: quão quieto um round pode ser |
| `PLANT_TEMPO` | 0,100 | varredura contra Plant% (alvo 46–60) |
| `DEFUSE_BASE` | 0,065 | varredura contra CT-win; foi a única alavanca eficaz |
| `CLUTCH_X` | 0,090 | o relógio subiu o 1v3 para 13,5%; ajustado para 12,3% |

Achado de calibração: **`LADO_CT` praticamente não afeta o CT-win** (60,5% → 60,4% variando
de 0,35 a 0,65). O desequilíbrio de lado é estrutural — vem de "relógio expira sem plant ⇒
CT vence" —, não do duelo. A alavanca correta foi o pós-plant, que estava no piso da faixa
real (56%) e subiu para 64%, dentro de 56–72.

## 3. Efeito medido

### 12/12 métricas macro na faixa

KPR 0,673 · CT-win 50,8% · Plant 47,0% · T pós-plant 64,5% · anti-eco 77% · conversão
pós-pistol 71% · clutch 1v1 49,5% / 1v2 25,0% / 1v3 12,3% · favorito 0-3 52,5% · favorito
16+ 87,0%.

### Forma do round

| Medida | Antes | Depois |
|---|---|---|
| Rounds com 0 ou 1 kill | **0,0%** | **6,9%** |
| Rounds por eliminação total | 23,9% | 40,6% |
| Rounds por tempo/default | 7,0% | 12,1% |
| `CLOSE_MEN` (sorteio artificial) | 16,5% dos rounds | **removido** |

Distribuição de kills por round: `0:4,5 1:2,5 2:5,7 3:3,5 4:6,4 5:4,4 6:7,1 7:8,6 8:22,7 9:34,7`.

Honestamente: o pico em 8–9 **continua** (57,4%). O round ganhou tempo, mas quando a briga
começa ela ainda tende a resolver por eliminação. A forma melhorou de barra-dupla-com-vales
para uma cauda contínua com pico no fim, o que não é a curva do CS real.

### Assinatura de estilo destravada

O **Spacetaker passou a abrir acima da média** — critério que falhava desde a Etapa 1. O
relógio deu efeito ao ritmo do playstyle: estilo agressivo agora gera contato de fato.

## 4. Correção de método — duas faixas minhas eram infundadas

Na Etapa 1 escrevi duas faixas sem fonte pública que as sustentasse: "rounds com 0 ou 1 kill
em 8–20%" e "mapas apertados em 45–70%". Ajustar o motor para acertá-las seria calibrar
contra um número inventado. Foram reclassificadas:

- **rounds quietos** viraram um gate **estrutural** (`>2%`). A afirmação que esta etapa
  sustenta de verdade é que round quieto passou a ser **possível** — antes era 0,0% por
  construção;
- **mapas apertados** virou **relatório**, e passou a ser medido só entre times equilibrados
  (|Δforça| ≤ 3), que é a única versão da pergunta com sentido: o round-robin da suíte cruza
  força 103 com 73, e nesses confrontos o atropelo é o resultado *correto*. Valor atual entre
  equilibrados: **31,9%**. Sem fonte para a faixa, não vira gate.

## 5. Duas hipóteses minhas foram refutadas

Na Etapa 3 registrei que o relógio provavelmente resolveria o **desvio intra-jogador**
(0,167; alvo 0,22–0,32). **Estava errado.** Três hipóteses testadas, três refutadas:

1. volatilidade da forma (`PERFIL_TIER.vol`): dobrar move 0,168 → 0,180;
2. relógio do round: 0,168 → 0,167, sem efeito;
3. piso da forma (`FORMA_PISO_BASE` × `FORMA_PISO_AMORT`, grade de 18 combinações): tudo
   entre 0,165 e 0,173.

A causa real, agora identificada: as kills se distribuem dentro do mapa por **sorteio
multinomial com pesos fixos**, que é o caso de **menor dispersão possível**. O CS real é
superdisperso — quem está bem no mapa tende a levar também as próximas kills. Resolver exige
**momentum individual intra-mapa**, mecânica nova. Ficou registrado em `perfis.js` sob o dono
`distribuicao`, com o diagnóstico completo, para não ser reinvestigado do zero.

O segundo pendente, **Entry não lidera opening kills** (0,114 contra 0,131 do Rifler), teve a
causa medida: o duelo de abertura ainda é decidido por firepower bruto, e `AGR_ABRE ≈ 1,8`
inverte a ordem. **Não foi aplicado aqui de propósito**: é balanceamento de função, merece
commit próprio e não pode entrar de carona no commit do relógio.

## 6. Âncoras atualizadas

1. `economy-and-clutches` (seed 1): 5-13 → **11-13**.
2. `repeated-overtime`: seed 111 → **515**, que reproduz 22-18 em 40 rounds (três
   prorrogações). O guarda `totalRounds>=30` segue confirmando a cobertura.
3. `campaign-best-of-three` (seed 9): 1-2 em Nuke,**Mirage**,Ancient.
4. `campaign-golden.json` (sandbox): 2-0 em dois mapas → **2-1 em três**.

## 7. Validação

22/22 suítes verdes (`npm run validate`). Snapshot dos 85 jogadores **idêntico**: a estrutura
do round não toca classificação nem OVR.
