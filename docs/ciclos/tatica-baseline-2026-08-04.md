# Baseline tático — o que os eixos de identidade já explicam hoje (04/08/2026)

> Medição de caracterização, **sem nenhuma alteração no motor**. É o "antes"
> contra o qual a camada tática de `src/domain/tactics/` vai ser julgada.
> Reproduzir com `node bancada/ferramentas/tatica-baseline.js --mapas 400`.

## A pergunta

Descontada a diferença de força efetiva, algum eixo de identidade tática explica
o resultado de um confronto **hoje**, antes de a camada existir?

A resposta esperada era **zero para todos**. Ela veio zero para **um só**, e isso
mudou o desenho da fatia seguinte.

## Método

- 136 pares dos 17 elencos × 400 mapas cada = **54.400 mapas**, seed determinística
  por mapa e orientação alternada para cancelar viés de lado;
- **correlação parcial** entre a diferença de cada eixo e a taxa de vitória,
  controlando pela diferença de força efetiva. Parcial e não bruta: sem controlar
  a força, qualquer eixo correlacionado com elenco bom apareceria explicando o
  jogo;
- IC95% por transformação z de Fisher — um `r` de 0,08 em 136 pares não é achado;
- **prova sintética**: um resultado fabricado com sinal conhecido em `leitura`,
  que o mesmo estimador precisa recuperar. Sem ela, "deu zero" seria
  indistinguível de estimador quebrado. Recuperou `r=0,653`;
- **teste de robustez**: a taxa é limitada a [0,1] e pares desiguais saturam.
  Refeito nos 131 pares sem saturação — sinais e magnitudes se mantiveram.

Sanidade do estimador: força efetiva × taxa de vitória deu `r = 0,967`.

## Resultado

| eixo | r bruto | r parcial | IC95% | veredito |
|---|---:|---:|---|---|
| `ritmo` | 0,526 | **−0,203** | [−0,359, −0,035] | não nulo |
| `estrutura` | −0,307 | **+0,344** | [0,187, 0,485] | não nulo |
| `utilitaria` | −0,256 | **+0,480** | [0,339, 0,600] | não nulo |
| `leitura` | 0,165 | +0,136 | [−0,033, 0,297] | **NULO** |
| `dependencia` | 0,134 | **+0,302** | [0,141, 0,448] | não nulo |

## Interpretação

**`leitura` é o único slot vazio, e era exatamente a previsão.** A qualidade do
IGL só chega ao jogo pelo OVR dele; não existe canal pelo qual ele influencie o
resultado *por ser IGL*. É esse vazio que a camada tática existe para preencher.

**Os outros quatro já agem — e é coerente que ajam**, porque são construídos
sobre atributos que o motor já consome direto:

- `utilitaria` é a média de `ut` do elenco, e `ut` alimenta `utilityLoad`,
  `assistContext`, `preservationValue` e `ROLE_PERFIL.Support`. Seria estranho se
  não aparecesse — é o eixo com maior efeito residual de todos;
- `estrutura` sai de `structure` dos playstyles mais a presença de IGL, e
  playstyle alimenta química e classificação;
- `ritmo` sai de `pace` e `en`, e `en` carrega o maior coeficiente de contato do
  motor (`CONTACT_EN`). O sinal **negativo** diz que expor-se mais custa mais do
  que a força efetiva captura;
- `dependencia` mede concentração de `fp`, e o expoente `EXP_KILL:1.15` do
  sorteio de duelo é superlinear — um time concentrado converte melhor.

## Consequência para o desenho da camada

**A camada não pode carregar seu peso pelos quatro eixos que já agem.** Se
`planejarRound` fizer `utilitaria` alta render mais uma vez, o efeito é contado
duas vezes e o resultado é balanceamento disfarçado de realismo.

O que a camada tem de legítimo para acrescentar é:

1. **`leitura`** — o canal que hoje não existe;
2. **a interação plano × contra-plano**, que também não existe: hoje nenhuma
   decisão de um time depende do que o outro decidiu.

Isso valida a decisão de desenho já tomada em `round-plan.mjs`:
`confrontoDePlanos` premia **acertar a leitura**, não os eixos em si. Os eixos só
escolhem *qual plano*; eles não entram no resultado por conta própria.

## Um risco concreto, achado por esta medição

`ritmo` já pesa **−0,203**: times rápidos rendem menos do que a força prevê. E o
desenho atual faz `ritmo` alto empurrar para `tempo:"rapido"`, que por
`confrontoDePlanos` levanta `ritmoContato`. Isso **amplifica uma penalidade que
já existe**.

Não é necessariamente errado — pode ser que o CS real puna mesmo o time rápido
sem estrutura. Mas é efeito somado a efeito, e precisa ser medido depois de
ligar, com esta mesma ferramenta, não presumido.

## Segunda medição: a camada LIGADA (mesmo dia)

Ligada nas mesmas seeds, com `--tatica`, a camada roda: **558 mil rounds
decididos**, crenças formadas, leitura usada em ~55% dos rounds. E `leitura`
**continua nula** no resultado: `r` parcial +0,109, IC95% [−0,061, 0,272].

O caminho até entender isso passou por três defeitos meus, e os dois primeiros
eram do modelo, não da calibração:

**1. Impasse de bootstrap.** Sem crença, todo time jogava 50/50; jogando 50/50,
ninguém tinha padrão; sem padrão, nenhuma crença jamais se formava. A leitura foi
usada em **0,0% de 558 mil rounds**. Faltava o time ter tendência PRÓPRIA — a
inércia, que repete o jogo anterior mais quando o time é estruturado e quando deu
certo.

**2. Medir a coisa errada.** Com inércia, um time repete ~56% das vezes — mas
ainda vai em A e em B metade de cada no ACUMULADO. A distribuição marginal
continua 50/50, e o modelo contava frequência de direção. Contar frequência não
enxerga persistência. O padrão está na TRANSIÇÃO, então passou a se observar
"ele repetiu?", e a previsão de direção se reconstrói com a última direção vista.
Depois disso a leitura passou a ser usada em 55% dos rounds.

**3. E aí veio o achado que importa: o mecanismo é quase de soma zero.** O CT
quer COINCIDIR e o T quer DIVERGIR — isso é *matching pennies*, cujo equilíbrio é
50/50 com ganho zero por construção. O read só pode pagar na ASSIMETRIA, e a
assimetria disponível é pequena:

| diferença de leitura | acerta apostando |
|---|---:|
| CT lê muito melhor | 50,5% |
| leitura parecida | 50,3% |
| CT lê muito pior | 50,0% |

Com inércia agressiva (`INERCIA_BASE .70`, `INERCIA_ESTRUTURA .90`) a vantagem
sobe para 51,9% — e `leitura` **continua nula**. E com `ACERTO_ABERTURA` em
**0,45**, oito vezes o valor de projeto e maior que o clamp inteiro de
`openEdgeA`, também continua nula.

**Conclusão medida: adivinhar direção não transmite ao resultado.** A conta não
fecha por muito: ~2 pp de vantagem de acerto, aplicados a UM duelo por round,
dão algo da ordem de 0,5 pp de taxa de vitória de mapa — abaixo do ruído da
medição e muito abaixo do que alguém percebe jogando.

Não é problema de calibração, e por isso **nenhuma constante foi ajustada para
fazer o número aparecer**. Inflar `ACERTO_ABERTURA` até `leitura` ficar
significativa seria escolher o resultado antes da evidência.

### O que fica decidido

- a arquitetura está pronta, ligada e **desligada por padrão**: golden e snapshot
  bit a bit idênticos, `tools/check-tactics-layer.js` cobra a chave em 0;
- **a decisão de DIREÇÃO não é o canal certo** para o valor da leitura. Ela
  continua no modelo porque cria a interação plano × contra-plano, mas não é ela
  que vai fazer o IGL valer;
- o que falta é decidir **quanto** ler deve valer, e por qual canal. Isso é
  escolha de produto e de balanceamento, não de calibração: exige medição
  pareada e os dois indicadores acumulados.

## O que esta medição NÃO diz

- não diz que os quatro eixos estão calibrados corretamente hoje, só que agem;
- não diz que `leitura` *deveria* valer alguma coisa — diz que hoje não vale;
- não mede o macro (KPR, CT-win, plant, clutch). Isso é trabalho de
  `bancada/suites/realismo.js` e continua sendo o gate inegociável.
