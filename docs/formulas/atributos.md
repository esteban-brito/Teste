# Os sete atributos — o que cada um significa e onde cada um é lido

> **Fonte deste documento: o código, não a memória.** Cada coeficiente abaixo foi
> lido em `src/domain/` em 04/08/2026, e cada distribuição foi medida sobre os 85
> jogadores de `src/data/players.mjs`. Se um número aqui divergir da fonte, a
> fonte ganha — e o documento está com defeito.
>
> `docs/formulas/roles.md`, `playstyles.md`, `ovr.md` e `chemistry.md` explicam o
> que o motor **faz** com estes atributos. Este arquivo explica o que eles **são**
> e por onde entram.

## Por que este documento existe

Os sete atributos são a única entrada factual do jogador — tudo o mais (função,
playstyle, OVR, química, rating simulado) é derivado deles. Mesmo assim o
significado de cada um estava espalhado entre comentários de módulo, e nenhum
lugar respondia "quem lê `tr`, e com que peso?".

Sem essa resposta não se constrói decisão tática: uma IA que escolhe ritmo e
comprometimento precisa saber qual atributo sustenta cada escolha.

## Distribuição real dos 85 jogadores

Medida em 04/08/2026 sobre `src/data/players.mjs`. **Não há guarda executável
para esta tabela** — `check-doc-measurements.js` só prova contagem de linhas de
arquivo, e a marca dele não serve aqui. Ela envelhece quando um time entra;
reproduza com:

```bash
node --input-type=module -e "import {ATRIBUTOS} from './src/data/players.mjs';
const A=['fp','en','tr','op','cl','sn','ut'];
const q=(v,p)=>{const s=[...v].sort((a,b)=>a-b);return s[Math.floor((s.length-1)*p)];};
for(const k of A){const v=ATRIBUTOS.map(p=>p[k]??0);
  console.log(k,Math.min(...v),q(v,.25),q(v,.5),q(v,.75),Math.max(...v),
    (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1));}"
```

| attr | mín | P25 | mediana | P75 | máx | média | <20 | >80 | zeros |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `fp` | 2 | 41 | 69 | 88 | 100 | 63.2 | 8 | 31 | 0 |
| `en` | 2 | 25 | 44 | 62 | 93 | 46.2 | 12 | 10 | 0 |
| `tr` | 1 | 21 | 36 | 55 | 94 | 36.9 | 21 | 2 | 0 |
| `op` | 10 | 28 | 63 | 80 | 97 | 58.0 | 5 | 20 | 0 |
| `cl` | 6 | 34 | 49 | 68 | 94 | 51.6 | 3 | 14 | 0 |
| `sn` | 0 | 0 | 1 | 24 | 98 | 23.6 | 63 | 18 | 36 |
| `ut` | 16 | 47 | 58 | 71 | 98 | 59.3 | 2 | 13 | 0 |

Três leituras que importam mais que os números:

- **`sn` não é uma escala, é um interruptor.** 20 jogadores têm `sn>=60`, com
  média **90,1**; os outros 65 têm média **3,1**, e 36 são exatamente zero. Não
  existe AWPer mediano no acervo — ou o jogador joga de AWP, ou não joga;
- **`tr` é o mais comprimido.** Mediana 36,9 e só **2** jogadores acima de 80.
  Hoje o trade quase não separa ninguém — é o atributo com menos poder
  discriminante dos sete;
- **`fp`, `op` e `ut` são os generosos.** Mediana entre 58 e 69, e 31 jogadores
  com `fp>80`. São eles que carregam a hierarquia.

## `fp` — Firepower

**O que é:** poder de fogo com rifle. É o que decide quem *fraga* dentro do time,
não quem *vence* o round.

| Onde é lido | Peso |
|---|---|
| `nmStats6` → eixo `fogo` | integral, **exceto no AWPer** (ver `sn`) |
| `ROLE_PERFIL` | Rifler `.50` · Entry `.20` · Lurker `.20` · AWPer `.05` |
| `ROLE_CONTRA` | AWPer `.017` · Support `.039` |
| `fragPeso` | `(FRAG_FP_BASE 35 + fp) × …` — é a **base** do volume de frag |
| `preservationValue` | um dos quatro termos de `(sn+cl+ut+fp)/400` |

## `en` — Entrada

**O que é:** capacidade de abrir espaço entrando primeiro e de sobreviver a isso.

| Onde é lido | Peso |
|---|---|
| `nmStats6` → eixo `ent` | integral |
| `ROLE_PERFIL` | Entry `.50` · Support `.20` |
| `ROLE_CONTRA` | Lurker `.15` · AWPer `.08` · Support `.06` |
| `IGL_ROLE_AFIN` | Support `−.093` (só para IGL) |
| `exposureProfile` | `CONTACT_EN` — abertura CT `.30`, TR `.35` |
| `tradeContextProfile.tradeability` | `(en+tr)/200` |
| `sideAffinityRaw` lado T | `.08 × (en − 45)` |
| `prepareTeam.open` | `.30` do índice de abertura do time |

**É o maior coeficiente de contato do motor.** `CONTACT_EN` na abertura vale
`.30`/`.35` contra `.06` de `op` — quem decide quem se expõe primeiro é `en`,
não `op`.

## `tr` — Trade

**O que é:** trocar a morte do companheiro e jogar em dupla.

| Onde é lido | Peso |
|---|---|
| `nmStats6` → eixo `tr` | integral |
| `ROLE_PERFIL` | Support `.30` · Rifler `.20` |
| `ROLE_CONTRA` | AWPer `.04` · Lurker `.04` |
| `tradeContextProfile` | nos **dois** termos: `readiness (tr+ut)/200` e `tradeability (en+tr)/200` |
| `duelo()` | `W_TR_KILL .32` — inclina quem leva a kill de troca |

## `op` — Abertura

**O que é:** ganhar o primeiro duelo do round. Distinto de `en`: `en` é ir, `op`
é ganhar quando vai.

| Onde é lido | Peso |
|---|---|
| `nmStats6` → eixo `ab` | integral |
| `ROLE_PERFIL` | Rifler `.30` · Entry `.30` · Lurker `.30` · AWPer `.12` |
| `exposureProfile` | `CONTACT_OP` — abertura `.06` |
| `duelo()` | `W_OP_KILL .28` — inclina quem leva a kill de abertura |
| `prepareTeam.open` | `.35` — o maior termo do índice de abertura |
| `sideAffinityRaw` lado T | `.07 × (op − 50)` |

## `cl` — Clutch

**O que é:** decidir em desvantagem numérica.

| Onde é lido | Peso |
|---|---|
| `nmStats6` → eixo `cl` | integral |
| `ROLE_PERFIL` | Lurker `.50` |
| `ROLE_CONTRA` | Rifler `.067` |
| `IGL_ROLE_AFIN` | Entry `+.098` (só para IGL) |
| `combateRound` | `CLUTCH_DUEL .22` sobre `(cl − 50)/100` do sobrevivente |
| `exposureProfile` | termo posicional de Lurker e Rifler |
| `preservationValue` | um dos quatro termos |
| `sideAffinityRaw` lado CT | `.08 × (cl − 50)` |

## `sn` — Sniper (AWP)

**O que é:** habilidade de AWP. É o atributo estruturalmente diferente dos
outros seis.

| Onde é lido | Peso |
|---|---|
| `nmStats6` | **SUBSTITUI `fogo`** quando a função é AWPer — o AWPer mata com a AWP, não com o rifle |
| `ROLE_PERFIL.AWPer` | **`.80`** — o maior coeficiente isolado de todo o sistema de funções |
| `ROLE_CONTRA` | Rifler `.18` · Support `.10` · Entry `.08` · Lurker `.06` |
| `exposureProfile` | termo posicional do AWPer |
| `preservationValue` | um dos quatro termos |
| `prepareTeam.open` | `.20` |
| `sideAffinityRaw` lado CT | `.05 × (sn − 35)` |

**Duas consequências que não são óbvias:**

1. `sn` é o único atributo que **muda o significado de outro**. Ao virar AWPer,
   o jogador passa a ser avaliado por `sn` no eixo `fogo`, e o `fp` dele sai da
   conta de nível. Um AWPer com `fp` alto não ganha nada por isso na receita;
2. o `.80` do `ROLE_PERFIL.AWPer` é **exceção declarada** no código: o AWPer é a
   única função do CS definida por um stat só. Colocá-lo na escada `.50/.30/.20`
   dos outros foi testado e tirou o `sh1ro` de AWPer e a AWP do `Jame`.

## `ut` — Utilitária

**O que é:** granadas e criação de espaço sem tiro.

| Onde é lido | Peso |
|---|---|
| `nmStats6` → eixo `ut` | integral |
| `ROLE_PERFIL.Support` | `.50` |
| `ROLE_CONTRA` | AWPer `.04` · Rifler `.04` · Entry `.02` |
| `assistContextProfile` | `ut/100` — é a **única** entrada desse perfil |
| `tradeContextProfile.readiness` | `(tr+ut)/200` |
| `preservationValue` | um dos quatro termos |
| `combateRound` | `ASSIST_UT_W .9` no sorteio de quem assiste |
| `utilityLoad` | agregado do TIME, pesado por `UTIL_COMPRA` da classe de compra |
| `prepareTeam.open` | `.15` |
| `sideAffinityRaw` lado CT | `.06 × (ut − 50)` |

**É o único atributo com efeito coletivo.** `utilityLoad` soma a utilitária dos
vivos e alimenta `UTIL_PLANT` e `UTIL_RETAKE`: a diferença de utilitária entre os
dois times muda a chance de plantar e de retomar. Todos os outros seis agem por
jogador.

## Os seis eixos × os sete atributos

As receitas de playstyle (`NM_DEF`) e as contraindicações (`STYLE_CONTRA`) não
falam em atributo cru: falam em **seis eixos**, produzidos por `nmStats6`.

| eixo | vem de |
|---|---|
| `fogo` | `fp` — **ou `sn`, se a função for AWPer** |
| `ent` | `en` |
| `ab` | `op` |
| `tr` | `tr` |
| `cl` | `cl` |
| `ut` | `ut` |

São seis e não sete porque `fp` e `sn` disputam o mesmo eixo. Fora dessa
substituição, `sn` só age por `ROLE_PERFIL`/`ROLE_CONTRA`, exposição, preservação
e afinidade de lado — nunca pela receita do playstyle.

## O que isto diz para a camada tática

Quatro leituras que orientam onde uma decisão de round pode pegar:

1. **quem se expõe é `en`**, com folga — `CONTACT_EN` é cinco vezes `CONTACT_OP`.
   Uma decisão de *ritmo* deve encontrar `en`, não `op`;
2. **`ut` é o único canal coletivo já existente.** Uma decisão de *comprometimento
   de utilitária* tem onde pegar sem inventar mecânica: `utilityLoad` já muda
   plant e retake;
3. **`tr` está subaproveitado** — mediana 36,9, dois jogadores acima de 80. Uma
   decisão que dependesse muito de trade hoje separaria pouco os times;
4. **`cl` é o único que já responde a contexto de desvantagem** (`CLUTCH_DUEL`).
   É o gancho natural para planos que envolvem ficar em minoria de propósito.
