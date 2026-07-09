# AUDITORIA · Calibrador Inteligente (sandbox.html)
> Data: 2026-07-09 · Escopo: só a IA/calibrador dentro de `sandbox.html` (linhas ~995-2205), não o resto do arquivo.
> Método: leitura linha a linha do pipeline completo (config snapshot -> geração de candidatos -> busca -> score -> refino -> render -> apply), cruzando com `game.js` (`nmOVR`, `evaluateTeam`, `forcaTime`) para medir custo real.
> Severidade: 🔴 bug confirmado · 🟠 falha de design (explica a IA parecer "burra") · 🔵 otimização · 🟡 código mal escrito/duplicado

## Resumo executivo

Os 4 achados abaixo são a causa raiz dos três sintomas que você relatou: **lento, burro e mal escrito**. Não são independentes — o achado #2 é a razão de ser lento, o achado #4 é a razão de parecer burro, e o achado #1 desperdiça metade do orçamento de busca por um bug bobo de uma linha.

| # | Achado | Severidade | Sintoma que explica |
|---|---|---|---|
| 1 | `deltasFor()` ignora o teto pedido | 🔴 bug | busca redundante entre fases |
| 2 | Cada candidato testado reavalia a liga inteira (17 times/85 jogadores) | 🔵 performance | lentidão/travada |
| 3 | `intentionState`/`sessionRegressions` reavaliam a liga inteira 1x por intenção monitorada, em todo render | 🔵 performance | lentidão cresce com a sessão |
| 4 | `compareCalibration` ignora o `cost` ponderado e decide por prioridade lexicográfica rígida | 🟠 design | "IA burra" |

---

## 🔴 #1 — `deltasFor(max)` gera deltas maiores que o teto pedido

`sandbox.html:1541`
```js
function deltasFor(max){
  const BASE=[.03,.06,.09,.12,.16,.22];
  if(max<=.22)return BASE;          // <- não filtra! devolve tudo, até .22
  const MORE=[];
  if(max>.22)MORE.push(.30,.40);
  ...
  return [...BASE,...MORE.filter(d=>d<=max)];  // MORE é filtrado, BASE não
}
```

Toda fase com `maxDelta<=.22` (ou seja, a fase 1 dos dois modos) devolve a lista `BASE` **sem filtrar**. Resultado:

- Modo `ia`, fase 1 (`maxDelta:.12`): testa deltas de `.16` e `.22` mesmo assim — quase o dobro do teto.
- Modo `ia`, fase 2 (`maxDelta:.22`): gera exatamente a **mesma lista** `[.03,.06,.09,.12,.16,.22]` da fase 1.

Isso quebra a lógica documentada de "fases progressivas" (escalar o dano só se necessário) e faz a fase 2 inteira (`generateRoleCandidates`, `generateRole2Candidates`, `generateDeepRoleCandidates`) **retestar candidatos idênticos aos da fase 1**, gastando metade do orçamento (`maxTests`/`maxMs`) sem cobrir nenhum caso novo antes de chegar nas fases 3-5, que são as únicas que realmente escalam o dano.

**Correção:** `return BASE.filter(d=>d<=max);` no primeiro `return`, e usar `[...BASE,...MORE].filter(d=>d<=max)` no final (a linha final já filtra `MORE` mas por segurança/consistência filtrar tudo junto).

---

## 🔵 #2 — Cada candidato testado reavalia a liga inteira

`findCalibration -> evalOne` (`sandbox.html:1940`):
```js
const evalOne=(changes,label,phaseIndex)=>{
  ...
  restoreConfig(beforeConfig);
  applyCalibChanges(changes);
  const after=mainPlayer(), now=impactSnapshot(), diff=snapshotDiff(proposalBase,now);
  const cumulativeDiff=snapshotDiff(cumulativeBase,now);
  ...
```

`impactSnapshot()` (`sandbox.html:1094`) roda `E.TEAMS.forEach` → `evaluateTeam` para **todos os 17 times / ~85 jogadores**, e cada `evaluateTeam` chama `E.forcaTime` (química completa do time) mais `nmOVR` por jogador (dot products, `styleMatch`, `curvaOVR`...). Isso acontece **para cada candidato testado**, mesmo quando o candidato só poderia afetar 1-2 jogadores.

Com `maxTests` até 22000 e `maxMs` até 9000ms (modo `ia`), o calibrador pode rodar dezenas de milhares dessas reavaliações completas da liga em uma única sugestão. Isso é o motivo estrutural de a busca "IA" ser lenta e de precisar de um "orçamento anti-trava" (`sliceMs`/`setTimeout(0)`) só para não travar a aba.

**Não é preciso reavaliar a liga inteira por candidato.** Praticamente todo `change` gerado (`makeChange`, `makeContraChange`, `makeStyleFitChange` etc.) mexe em pesos de **role/style específicos**; dá para restringir a reavaliação aos times que têm jogador nessas roles, ou pelo menos separar "avaliar só o jogador-alvo" de "avaliar times afetados" em vez de recalcular os 17 times a cada tentativa.

---

## 🔵 #3 — `intentionState` reavalia a liga inteira por intenção, em todo render

`sandbox.html:1387`:
```js
function intentionState(intent){
  const current=impactSnapshot().players.find(player=>player.key===intent.key); // <- 1 impactSnapshot() por chamada
  ...
}
function sessionRegressions(){
  const session=ensureCalibSession();
  return Array.from(session.intentions.values()).map(intentionState).filter(...);
}
```

`session.intentions` cresce 1 por sugestão aplicada. `sessionRegressions()` é chamado em `renderImpactPanel`, `renderReportPanel` e `buildCalibrationReport` — ou seja, em **todo re-render da UI**, não só durante a busca. Se você já aplicou 10 ajustes numa sessão de calibração, cada render do painel de impacto dispara **10 reavaliações completas da liga** (mais a que já roda em `impactReport()`), quando bastava calcular `impactSnapshot()` uma vez e reusar para todas as intenções.

Isso explica por que o sandbox tende a ficar mais pesado quanto mais tempo você passa numa sessão de calibração (mais intenções acumuladas = mais reavaliações redundantes por clique).

**Correção:** calcular `const snap=impactSnapshot()` uma vez em `sessionRegressions()` e passar para `intentionState(snap,intent)`.

---

## 🟠 #4 — A IA não decide pelo `cost` ponderado; decide por prioridade rígida (isto é a "burrice")

`scoreCalibration` (`sandbox.html:1876`) calcula um custo ponderado bem elaborado, combinando 11 métricas (delta, role/style trocado, penalidade de realidade, raros que pioram, impacto de OVR, colateral quadrático, corte amplo, regra "fina" etc.) com pesos ajustados por modo (`ia` vs `realista`).

Mas quem decide o vencedor entre dois candidatos não é esse `cost` — é `compareCalibration` (`sandbox.html:1896`):
```js
function compareCalibration(a,b,strategy){
  if(!b)return -1; if(!a)return 1;
  for(const key of strategy.priority||[]){
    const av=a.costInfo?.[key]??0, bv=b.costInfo?.[key]??0;
    if(Math.abs(av-bv)>1e-9)return av-bv;   // decide aqui, na 1ª métrica que difere
  }
  return a.cost-b.cost;                     // só chega aqui se TUDO empatar
}
```

Isso é uma comparação **lexicográfica rígida** sobre a lista `priority` (para o modo `ia`: `collateralRoleChanges, teamChanges, rareWorsened, realityPenalty, ovrImpact, styleChanges, deltaCost, changed`). Na prática:

- Um candidato com `collateralRoleChanges=0` **sempre** vence um com `collateralRoleChanges=1`, não importa o quão pior ele seja em delta de pesos, dano de realidade, impacto de OVR etc.
- O `cost` (a soma ponderada, cuidadosamente calibrada com pesos como `collateral:95`, `reality:9`, `isolated:1.5`...) só é consultado no **empate exato** de todas as 8 métricas de prioridade — o que na prática quase nunca acontece com floats.

Ou seja: todo o ajuste fino de pesos em `CALIB_STRATEGIES` é, na prática, **decorativo** — ele não pondera trade-offs, só desempata candidatos que já são idênticos em tudo mais. A IA não está fazendo uma otimização multi-critério; está aplicando um filtro em cascata de tudo-ou-nada. Isso bate diretamente com a sensação de "burra e limitada": ela pode descartar uma solução globalmente muito melhor por causa de 1 ponto a mais numa métrica que vem primeiro na lista, mesmo que o modo tenha um peso (`w.collateral`, `w.reality`...) desenhado pra permitir esse trade-off.

**Isto é uma decisão de arquitetura, não um typo — vale decidir com calma se o comportamento pretendido é "regras rígidas em cascata" (então o `cost`/pesos em `scoreCalibration` deveriam ser removidos ou reduzidos a tiebreaker documentado) ou "otimização ponderada" (então `compareCalibration` deveria comparar por `a.cost-b.cost` direto, e a lista `priority` vira só um recurso opcional, não a regra principal).**

---

## 🟡 Notas de código (mal escrito / duplicado)

- **Três geradores de candidato quase-iguais**: `generateRoleCandidates`, `generateRole2Candidates` e `roleLeverBank`/`generateDeepRoleCandidates` reimplementam a mesma ideia ("proponha mudar peso X do role-alvo, opcionalmente reduzir peso do role atual") com constantes mágicas ligeiramente diferentes e não documentadas (`d*.45` vs `d*.35` vs `d*.65` vs `d*.28`...). Não há comentário explicando por que os fatores diferem entre as três versões — parece deriva acidental de copiar-colar, não desenho intencional.
- Funções com múltiplas responsabilidades por linha e encadeamentos densos (ex.: `sandbox.html:1592-1607`, `:1746-1793`) tornam qualquer revisão futura desses pesos difícil de auditar visualmente.
- `evalOne` monta o mesmo objeto `result`/`candidate` (12+ campos) em três lugares diferentes (`evalOne`, `tryRefinement.consider`, e implicitamente no fallback) sem uma função construtora comum — risco de os três divergirem com o tempo.

---

## Prioridade de correção sugerida

1. **#1** — trivial (1 linha), corrige metade do desperdício de orçamento de busca imediatamente.
2. **#3** — trivial (hoist de uma chamada), melhora responsividade da UI em sessões longas sem tocar na busca.
3. **#4** — decisão de produto: escolher entre "cascata de regras" e "otimização ponderada" antes de mexer no código; é a mudança que mais deve destravar a percepção de "IA burra".
4. **#2** — a mais trabalhosa (escopar a reavaliação por time/jogador afetado), mas é a que resolve a lentidão de fato; vale fazer depois de #1 e #3 já aliviarem parte do volume de trabalho.
