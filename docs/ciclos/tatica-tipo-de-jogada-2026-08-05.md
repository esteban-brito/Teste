# A camada tática entra em jogo — tipo de jogada (05/08/2026)

> Ciclo que ligou `CFG_TATICA.ATIVA`. Sete commits, de `ad068bc` a `c6a57df`,
> publicados com CI verde (`31047835608`). É **balanceamento**: muda o resultado
> das partidas.
>
> O "antes" deste ciclo é [`tatica-baseline-2026-08-04.md`](tatica-baseline-2026-08-04.md).

## O problema que este ciclo resolveu

A camada de 04/08 estava construída, ligada ao motor e desligada por padrão,
porque `leitura` continuava nula. O relatório daquele dia concluiu que "o canal
está errado, não o valor". **Metade disso estava certo.**

Medido com braço de controle, 110 mil rounds por cenário:

| canal isolado | vale acertar (pp de round) | Plant% |
|---|---:|---:|
| controle (três em 0) | 0 por construção | 49,72 |
| só `ACERTO_ABERTURA` | **+1,19** | 49,71 |
| só `ACERTO_PLANT` | −0,07 | **47,36** |
| só `RITMO_CONTATO` | +0,23 | 49,52 |
| os três | **+1,63** | 47,17 |

O canal **não era fraco**: acertar valia 1,63 pp de round. Travada estava a taxa
de acerto, em 50,1% — o equilíbrio do *matching pennies*. Por isso
`ACERTO_ABERTURA` a oito vezes o valor de projeto não fez nada: **qualquer escala
vezes zero é zero.**

## O braço de controle, e por que ele passou a ser obrigatório

Com os três canais em ZERO — onde acertar não pode valer nada por construção — o
contraste "errou menos acertou" ainda deu **−0,79 pp ± 0,30**. `ctAcertou` não é
exógeno: a direção sai da inércia, a inércia depende de quem venceu o round
anterior, e quem venceu o anterior prevê quem vence o próximo.

Ler esse contraste sem subtrair o controle atribui ao canal um efeito que é
**seleção**. `bancada/ferramentas/tatica-baseline.js --canais` agora roda o
controle sempre e só reporta a coluna corrigida.

## O achado que ninguém tinha medido: `ACERTO_PLANT` não é canal de leitura

Ele responde a `utilitaria`, não a `ctAcertou` — contribuição corrigida −0,07 pp.
Mas derrubava o `Plant%` em **2,4 pontos** sozinho, porque empurrão simétrico num
processo de PRIMEIRO SUCESSO não se cancela: `1−∏(1−pᵢ)` é côncava, e ruído
simétrico abaixa a média (Jensen).

Pior: `utilitaria` é o eixo com **maior** efeito residual já existente (r=+0,48),
então o canal estava fazendo esse eixo pagar duas vezes — exatamente o que a
baseline de 04/08 proíbe. Baixado de `.045` para `.025`.

## Nenhuma receita sobre atributos é neutra em força

Três encodings independentes, três falhas idênticas:

| encoding | `forma[rush] × força` |
|---|---:|
| atributo cru, autocentrado por time | 0,779 |
| z-score por atributo sobre os 85 | 0,751 |
| resíduo do jogador contra ele mesmo | 0,782 |

Não é defeito de codificação. **Forma de atributo determina distribuição de
função, e função já tem preço** em `DUEL_CONVERSION` (Support .92, IGL .90) e
`FRAG_ROLE`. O `r = −0,508` de `executada` é o `.92` aparecendo.

Consequência forçada: **afinidade absoluta não pode pagar.** Só `assinatura`
(r = −0,118) e `vantagem` autocentrada no time (r = −0,067) são neutras, e são
elas que o motor consome. `forma` sai rotulada como diagnóstico, e a guarda
proíbe qualquer outro módulo da camada de lê-la.

## O que substituiu adivinhar

Trocar A|B por seis tipos **não matou** o jogo de soma zero — mudou o endereço
dele. `EVITA_COBERTA` faz o T fugir do que acredita coberto, e isso cancela a
leitura do CT. Matching pennies voltou pela adaptação em vez do vocabulário.

Mas a fuga deixa rastro, e ele é direcional:

| diferença de leitura | afinidade da jogada que o T rodou |
|---|---:|
| CT lê muito melhor | **0,0727** |
| leitura parecida | 0,0926 |
| CT lê muito pior | 0,0894 |

**Um time que enfrenta um leitor melhor roda jogadas que faz pior.** O canal
deixou de ser "acertar" e passou a ser "a qualidade da jogada que o adversário
conseguiu rodar" — que **não é soma zero**: se o T abandona a jogada de afinidade
0,29 pela de 0,10, ele perde execução tenha o CT adivinhado certo ou não.

É o CS real: um bom CT não vence adivinhando o site, vence tirando de você o que
você faz bem. E quem não tem assinatura não tem o que lhe seja tirado — a NAVI de
Estocolmo espera 0,004 de vantagem; FaZe e G2, ~0,29.

## Três hipóteses minhas, duas erradas

Registradas porque o método importa mais que o acerto.

| hipótese | previsto | medido |
|---|---|---|
| comprometimento do CT governa a leitura | +8,9 pp de acerto | **+0,5** |
| memória curta demais para 6 símbolos | ganho | **0,0** |
| `EVITA_COBERTA` cancela a leitura | — | **confirmado** |

As duas primeiras mudanças ficaram porque estão **certas**, não porque
funcionaram: 1,05 observação por jogada é indefensável, e um botão separado de
nitidez não existe no CS — a chamada de stack e a de leitura são uma só.

## O teto do anti-strat, e a barra que eu persegui errado

`leitura` não tinha por onde agir: quem lia bem e quem lia mal **acertavam
idêntico** (20,8% os dois). O eixo mexia só em `meiaVidaEfetiva` e
`LEITURA_CONFIANCA` — adaptar mais rápido e confiar mais, nenhum dos dois faz
concluir melhor.

O anti-strat (pseudo-contagens do repertório derivado, massa por `leitura`)
diferenciou pela primeira vez. Mas satura:

| `PRIOR_BASE` | `PRIOR_LEITURA` | diferenciação |
|---:|---:|---:|
| 0 | 0 | 0,84 pp |
| 4 | 8 | 1,24 pp |
| **2** | **14** | **2,24 pp** ← escolhido |
| 0 | 20 | 2,23 pp |
| 0 | 40 | 2,99 pp |

Mesmo dando ao melhor leitor 18 rounds de scouting — mais que um meio-tempo
inteiro de evidência ao vivo — o teto é ~3 pp. A observação dilui o prior e os
dois lados convergem para a mesma crença.

**`leitura` continua nula na correlação parcial (r = 0,031), e essa era a barra
errada.** Ela exige que o efeito supere o ruído amostral entre 136 pares, e o
mecanismo satura antes disso. O teto é estrutural, não de ajuste — e
provavelmente está certo assim: no CS real a leitura do IGL é efeito real e
modesto, inseparável do resto. Um eixo que sozinho explicasse o resultado de um
confronto seria menos fiel, não mais.

## Comparação pareada do que ficou publicado

Mesma amostra nos dois braços (`DIFICULDADE_N=12000`):

| | desligada | **ligada** | faixa |
|---|---:|---:|---|
| `Favorito gap 16+` | 85,1 | **85,7** | 82–93 |
| `invicto` | 4,2 | **4,5** | 4–6 |
| `Título (draftado)` | 26,6 | 26,5 | ≥25 |
| `Plant%` | 49,7 | 48,8 | 46–60 |
| `CT-round win%` | 52,3 | **52,3** | 47–54 |
| `KPR` | 0,669 | 0,668 | 0,66–0,78 |

Os dois indicadores acumulados foram juntos, e os dois se moveram na direção
**pré-declarada**: ler bem favorece o time forte, e o time do jogador quase
sempre é forte.

`CT-round win%` **não se moveu um décimo**, e isso é a prova do invariante de
soma zero na taxa-base: com seis jogadas o CT erra cinco de cada seis rounds, e
se acertar e errar valessem a mesma magnitude o T teria ganhado **+2/3 do canal**
em vantagem sistemática — deslocamento de LADO disfarçado de leitura.

## Um susto que era ruído

Com `N=3000` o `Título` marcou 24,8% e cruzou o piso de 25. A resposta certa não
era mexer numa constante: era **buscar amostra**. Com `N=12000` deu 26,5%
[25,7–27,3], e a baseline no mesmo N deu 26,6% — efeito nenhum. O IC da amostra
pequena já cruzava o piso nos dois braços.

## Âncoras de golden reescolhidas

Pelo protocolo, preservando a FORMA de cada cenário:

- `economy-and-clutches` **8 → 11**. A 8 passou a dar 13-5 em 18 rounds e deixou
  de exercitar a compra `force`; o cenário existe para cobrir as quatro classes,
  então trocou-se a seed, não a asserção. A 11 devolve 13-11 em 24 rounds;
- `repeated-overtime` **235 → 362**. A 235 passou a terminar 10-13 em tempo
  normal. A 362 devolve 22-20 em 42 rounds — três prorrogações, a mesma forma;
- `campaign-best-of-three`: série 1-2 → 2-1, mapas `Anubis,Nuke,Ancient`.
  Continua em três mapas, que é a razão de o cenário existir;
- `campaign-golden.json` regravado: Mirage 13-0 → 13-10, Inferno 13-7 inalterado.

## Validação

`npm run validate` fecha **26/26 suítes** e **20/20 checadores**.
`dificuldade.js` fecha **4/4 em `DIFICULDADE_STRICT=1`** com amostra de
fechamento. A guarda inverteu de propósito: `check-tactics-layer.js` agora exige
`ATIVA===1` e diz que **desligar também é balanceamento**, com a mesma prova.

## O que ficou aberto

- ~~**exibição passiva**~~ — **FECHADO no mesmo dia, e não como lacuna: como
  decisão.** Uma implementação pronta e verde foi recusada pelo responsável
  (*"prefiro que fique só dentro da IA do jogo mesmo"*) e desfeita sem publicar.
  Esta camada **não vai à tela**; `registro.tatica` fica sem consumidor de
  propósito. Ver a emenda da §11-bis de `docs/project-context.md`;
- `dependencia` e `teamAggression` continuam calculados e **sem consumidor**;
- o vocabulário de seis tipos é julgamento declarado, como `MAP_PROFILES`. O que
  a medição sustenta é que ele **separa**: os seis são o melhor de alguém.
