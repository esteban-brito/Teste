# Economia e arsenal reais — 26 de julho de 2026

> Etapa 5 do ciclo de fidelidade. **É balanceamento.** Substitui o pote de dinheiro do time
> por carteira e arsenal por jogador, em unidades de CS2.

## 1. O problema: as unidades não fechavam

Os prêmios eram exatos do CS2 — vitória $3.250, objetivo $3.500, escada de derrota
$1.400→$3.400, teto $16.000. Mas equipar **os cinco** custava `full: 4300`, enquanto no CS2
real um full buy custa isso **por jogador**.

Receita real com despesa cinco vezes barata tem duas consequências: o time quase nunca fica
sem comprar, e perder rounds quase não dói. Para um jogo que precisa ser difícil, era
dinheiro de graça.

Além disso o dinheiro era um pote único (`mA`, `mB`), o que impedia qualquer identidade
econômica individual: não havia como o AWPer ter dificuldade própria de sustentar a arma.

## 2. O que foi feito

### Carteira e arsenal por jogador

`mA`/`mB` viraram `dinA[5]`/`dinB[5]`. Prêmio de round, loss bonus e bônus de plant são
creditados **em cada carteira**, como no CS2.

O arsenal também é individual: `armado[i]` marca quem **sobreviveu com arma comprada**.
Quem sobrevive carrega o rifle e só repõe colete e utilidade (`CUSTO_REPOR`); quem morre
perde tudo e paga preço cheio. `combateRound` passou a devolver `vivosA`/`vivosB` para isso.

### Custos de CS2, por jogador

| Classe | Custo | Composição |
|---|---|---|
| `pistol` | 0 | pistola inicial |
| `eco` | 200 | upgrade de pistola |
| `force` | 2.500 | SMG/pistola forte + colete |
| `full` | 4.300 | rifle (2.700) + colete e capacete (1.000) + granada |
| `awp` | 6.050 | AWP (4.750) + colete e capacete + granada |

O time inteiro em full passou de **$4.300 para $21.500**. É o núcleo desta etapa.

Nota honesta sobre o `full: 4300`: ele **não** inclui um kit completo de utilidade (~$800 a
mais no CS2). Utilidade ainda não é recurso modelado — não há flash, smoke nem molotov com
efeito no round —, então cobrá-la seria cobrar por algo que não existe. O valor representa
rifle + colete + uma granada. Quando a utilidade virar recurso de verdade, o custo sobe junto.

### Decisão de compra: coletiva no nível, individual no loadout

A regra que faz a economia do CS parecer CS é a de **salvar**: um time que não consegue
equipar todo mundo faz eco completo e volta full no round seguinte. Forçar no meio do caminho
é o erro que drena a economia. Por isso o force-buy aqui é decisão **deliberada** — leitura
para negar o anti-eco, ou desespero após três derrotas seguidas —, nunca o estado padrão de
quem está sem dinheiro.

Efeito medido: o force-buy caiu de **30,5% para 13,5%** dos loadouts, e o eco subiu de 8,6%
para 15,3% no CT.

### Drop de arma

Mecânica central do CS e a razão de times profissionais comprarem em bloco: quem sobrou
dinheiro compra um rifle a mais ($2.700) e joga para o companheiro curto. Sem isso o time se
fragmenta em force buys que não acontecem no CS real.

### Recompensa por kill pela arma

`RECOMPENSA_ARMA` substitui o valor único por time: AWP **$100**, SMG $600, rifle e pistola
$300. É individual e creditada na carteira de quem matou.

### Eco-adjust do rating pela arma do jogador

`FA_ECO` comparava a **categoria de compra do time**. Agora compara a **arma de quem matou
com a de quem morreu**, que é o que o HLTV realmente faz. A AWP conta como full buy: matar
com AWP não é kill de eco.

## 3. Efeito medido

### Pela primeira vez no ciclo, macro E forma inteiramente verdes

12/12 métricas macro e 6/6 métricas de forma dentro das faixas reais.

| Métrica de compra | Antes | Depois | Faixa |
|---|---|---|---|
| Full buy no CT | 48,3% | **61,6%** | 55–75 |
| Eco no TR | 8,6% | **12,9%** | 10–25 |
| Conversão pós-pistol | 57,0% | **73,3%** | 60–84 |
| Anti-eco | 76,3% | **76,8%** | 70–90 |

Distribuição de loadout por jogador — CT: `pistol 9,6% · eco 15,3% · force 13,5% · full 55,6% · awp 6,0%`.

### O AWPer ganhou identidade econômica

Compra de AWP por função, em % dos loadouts:

| Função | AWP | full | eco/pistol |
|---|---|---|---|
| AWPer | **31,1%** | 32,1% | 23,8% |
| IGL | 3,8% | 59,7% | 23,5% |
| Rifler / Lurker / Support / Entry | **0,0%** | ~64% | ~23,5% |

O AWPer só consegue a arma em cerca de um terço dos rounds e ganha um terço do dinheiro por
abate. É uma assinatura que o modelo de pote único não podia ter.

Snapshot dos 85 jogadores **idêntico**: economia não toca classificação nem OVR.

## 4. Uma correção de registro

No documento da etapa do relógio afirmei que "o Spacetaker passou a abrir acima da média".
**Foi precipitado.** O critério passou por um fio e eu o promovi a gate sem verificar a
margem; assim que a economia deslocou os números ele voltou a falhar. Medindo: Spacetaker
0,078 contra média dos dez estilos 0,078 — margem de faca, estável em N=15/30/45.

Ele voltou para o grupo `abertura`, junto com "Entry lidera opening kills", porque os dois
têm a **mesma causa**: o duelo de abertura ainda é decidido por firepower bruto. A correção
está medida (`AGR_ABRE ≈ 1,8`) e vai em commit próprio, não de carona neste.

## 5. Âncoras atualizadas

1. `economy-and-clutches` (seed 1): 11-13 → **10-13**.
2. `repeated-overtime`: seed 515 → **200**, com 22-19 em 41 rounds (três prorrogações).
3. `campaign-best-of-three` (seed 9): 1-2 em Nuke,**Train**,Ancient.
4. `campaign-golden.json`: 2-1 em três mapas → **2-0 em dois**.

## 6. O que ficou de fora, e por quê

**Utilidade como recurso do round** (flash, smoke, molotov comprados e gastos, ligando o
atributo `ut` a execução e retake) não foi implementada. É a única parte do escopo original
desta etapa que não entrou: é uma mecânica nova de round, não uma correção de unidades, e
misturá-la à reforma econômica produziria um commit sem responsabilidade única. O custo de
`full` já está preparado para absorvê-la quando ela existir.
