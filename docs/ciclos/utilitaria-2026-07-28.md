# Utilitária como recurso do round

> Ciclo de 28 de julho de 2026. Última peça do escopo original da simulação.

## O que faltava

O atributo `ut` existia e pesava em duas coisas — assistências e exposição ao contato — mas
**granada nenhuma existia no modelo**. Era a diferença entre "o Support tem número alto de
utilitário" e "o Support fumaçou o meio e o time entrou". O custo do `full` (4300) já vinha
dimensionado prevendo isso: rifle 2700 + colete e capacete 1000 + **granada 300-600**.

## O modelo

**Carga de utilitária** de um lado, calculada na hora em que ela importaria:

```js
function cargaUtil(time,vivos,compras){
  if(!vivos.length)return 1;
  let soma=0;
  for(const i of vivos)soma+=(CFG_SIM.UTIL_COMPRA[compras[i]]??0)*(time.assistContext[i].utility/ASSIST_UTILITY_MEAN);
  return soma/vivos.length;
}
```

Três decisões, e o porquê de cada uma:

**Per capita, não por total.** A carga é a *média* entre os vivos, não a soma. Se fosse soma,
perder dois jogadores derrubaria a carga pela metade — mas a vantagem de homem **já está**
inteira em `PLANT_MEN` e `DEFUSE_MEN`. Dividir por total contaria o mesmo efeito duas vezes.
Per capita, o termo mede só a **qualidade** da utilidade disponível: perder o cara de
utilitária derruba a carga, perder o AWPer quase não mexe.

**O que cada compra carrega** (`UTIL_COMPRA`): `full` e `awp` = 1 (o preço já inclui granada),
`force` = 0,35 (SMG e colete não deixam troco), `eco` = 0,05, `pistol` = 0,20 (os $800 iniciais
compram uma flash ou uma smoke).

**Relativa, não absoluta.** O termo é `cargaT − cargaCT` na execução e `cargaCT − cargaT` na
retomada. Execução e retomada são **disputas**, não esforços isolados: uma smoke vale contra
quem não tem molotov para negar.

Essa terceira decisão veio de um erro medido. A primeira versão centrava em "full = 1", isto é,
`carga − 1`. O resultado foi desastroso e imediato: como o full buy é a maioria dos rounds e
ele dava exatamente zero, **todo o efeito era negativo** — o plant global caiu de 46,9% para
33,5% e estourou o piso de 46%. A forma relativa é zero-soma por construção: dois times full
não mudam nada.

## Onde entra

| fase | efeito |
|---|---|
| **execução** (`pPlant`) | `+ UTIL_PLANT × (cargaT − cargaCT)` — smoke e flash abrem o site |
| **retomada** (defuse) | `+ UTIL_RETAKE × (cargaCT − cargaT)` — molotov nega o pós-plant, flash entra |

Nenhum ponto novo de RNG. Com as duas constantes em zero o jogo é bit a bit o anterior —
provado pelo golden antes de calibrar.

## Calibração, e por que os valores são modestos

Varredura pareada, 3.825 mapas por braço. O espaço útil aqui é **estreito**, e três guardas
diferentes fecham o caminho:

| candidato | plant full/eco | Plant% global | T pós-plant | gap 16+ | invicto |
|---|---|---|---|---|---|
| 0 / 0 (base) | 49,0 / 41,8 | 46,9 | 64,9 | 84,8 | 4,8% |
| **0,025 / 0,025** | **51,0 / 35,3** | **46,6** | **66,7** | **84,2** | **5,2%** |
| 0,04 / 0,04 | 52,4 / 33,0 | 46,4 | 67,9 | 82,5 | 5,7% |
| 0,025 / 0,07 | — | 46,6 | 68,2 | 83,3 | **6,0%** |

- **`Plant%` tem piso 46 e a linha de base já estava em 46,9** — sobra pouco antes de qualquer
  mecânica nova ser considerada.
- **`T win pós-plant` tem teto 72** e sobe por **efeito de seleção**: quem consegue plantar com
  vantagem de utilidade é também quem segura melhor depois. Não é artefato, é consequência real
  — mas consome a folga.
- **`Favorito gap 16+` tem piso 82** e cai, porque utilidade é mais uma via de o time pior levar
  o round. Em 0,04 chegou a 82,5, a meio ponto do piso.
- **O invicto do elenco draftado tem teto 6%** e sobe junto. Em 0,025/0,07 bateu exatamente 6,0.

**Escolhido: `UTIL_PLANT = UTIL_RETAKE = 0,025`.** É o ponto em que a assinatura aparece e
nenhuma guarda fica na borda.

## O que a mecânica entrega

Plant do T e retomada do CT, por classe de compra (6.120 mapas):

| | full | force | eco |
|---|---|---|---|
| plant do T | **51,0%** | 37,2% | 35,3% |
| retomada do CT | **39,6%** | 27,3% | 24,9% |

A diferença de plant entre full e eco era de **7,2 pp** antes da mecânica e passou a **15,7 pp**.
O anti-eco subiu de 75,8% para 82,2% — comprar utilidade agora vale, e não comprar custa.

## Limite honesto

**O canal da retomada quase não se moveu.** Em 0,025 ele acrescenta pouco sobre o que a classe
de compra já fazia pela força do round: a diferença full-vs-eco na retomada foi de 14,4 pp para
14,7 pp. Ele só ganharia corpo em valores que colocam o invicto ou o T pós-plant na borda.

Isso é escolha deliberada, não descuido: preferi um efeito modesto e seguro a um número
vistoso com gate na borda. Se um dia o piso de `Plant%` ou o teto de `T pós-plant` for revisto
com fonte, a retomada é o primeiro lugar onde há retorno esperando.

## Validação

`npm run validate`, **24/24 suítes**. 12/12 macro, 6/6 forma, 15/15 assinatura individual,
4/4 dificuldade. Goldens regravados com seeds que preservam a forma de cada cenário — a do
`repeated-overtime` (132) sobreviveu à mudança e não precisou ser trocada.
