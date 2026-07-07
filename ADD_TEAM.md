# Adicionar um time ao draft9-0

O terreno foi preparado pra que adicionar um time seja **colar o texto → 1 comando → revisar → publicar**.
Os motores (PRISMA·ZÊNITE) calculam OVR, funções e sub-arquétipo a partir dos atributos crus — nunca se escreve OVR/role na mão.

## 1. Escreva o time (texto simples)

Um bloco por time, no mesmo formato que você já manda no chat:

```
NOME | CAMPEONATO | Colocação: Vice-campeão | Treinador: kakafu | País (Treinador): AUT | Cor: #e9edf3
 tabseN — País: GER | Rating: 1.18 | IGL: Não | Stats: FP: 90, EN: 33, TR: 13, OP: 82, CL: 46, SN: 84, UT: 89
 nex    — País: GER | Rating: 1.10 | IGL: Não | Stats: FP: 88, EN: 34, TR: 69, OP: 31, CL: 32, SN: 0, UT: 87
 tiziaN — País: GER | Rating: 1.01 | IGL: Não | Stats: FP: 30, EN: 56, TR: 22, OP: 27, CL: 87, SN: 0, UT: 77
 smooya — País: UK  | Rating: 1.00 | IGL: Não | Stats: FP: 39, EN: 3,  TR: 11, OP: 84, CL: 66, SN: 94, UT: 56
 gob b  — País: GER | Rating: 0.91 | IGL: Sim | Stats: FP: 12, EN: 39, TR: 34, OP: 28, CL: 39, SN: 8,  UT: 90
```

- **Atributos** 0–100: FP (mira/fogo) · EN (entrada) · TR (trade) · OP (abertura) · CL (clutch) · SN (AWP) · UT (utilitário).
- **Colocação**: Campeão / Vice-campeão / Top4 / Top8 / Grupos (aceita sinônimos; vira `Campeao/Final/Top4/Top8/Grupos`).
- **Cor**: opcional. Se faltar, o gerador escolhe uma cor livre e avisa.
- **País**: aceita apelidos (UK→GBR, etc.); o resto passa como veio (ISO-3).
- Nick repetido de outro time (ex.: dois `s1mple` de épocas diferentes) é resolvido sozinho com um `id` único.

## 2. Rode o gerador

```
node tools/add-team.js caminho/do/time.txt
```

Ele insere os 5 jogadores e o time no `game.js` (âncoras `//@jogadores` e `//@times`),
regenera a Base de Elencos (`elencos.html`) e roda o **lint**, que imprime o resumo com os OVRs
computados de cada time — use isso pra revisar se os overalls/funções ficaram como esperado.

## 3. Valide e publique

```
node bancada/run.js      # lint + realismo + rating (gate de não-regressão)
```

Depois: commit → push da branch → merge do PR (deploy). O time aparece automaticamente
**na roleta do jogo** e **na Base de Elencos**.

## Ferramentas do terreno

| Arquivo | O quê |
|---|---|
| `tools/add-team.js` | cola texto → insere no game.js + regenera elencos + lint |
| `bancada/roster.js` | regenera o `const DATA` do elencos.html a partir dos motores (fonte única) |
| `bancada/times.js`  | lint: atributos 0–100, IDs únicos, ≥1 IGL, país do treinador, invariante do Major, resumo por time |
| `bancada/run.js`    | suíte completa (times + realismo + rating) |

## Invariantes garantidos

- **Major sempre 16** (15 NPC + você), independente de quantos times existam — `iniciarTorneio` fatia `slice(0,15)`.
- **País do treinador** pode ir inline (`coachPais`) no time — times novos não mexem no `PAISES_MAP`.
- **Base de Elencos** nunca desatualiza: é regenerada dos motores, não editada à mão.
