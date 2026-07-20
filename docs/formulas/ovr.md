# OVR — ZÊNITE

Fonte executável atual: `nmOVR`, `ovrUnificado` e `iglOvr` em `game.js`.

## Qualidade de atributos

Para um estilo normal:

```text
statScore = dot(qualityWeights, sixAxes) / sum(qualityWeights)
```

`qualityWeights` é `ovrW` quando presente; caso contrário, usa a receita de
identidade `w`. A normalização impede que drift na soma dos pesos altere a
escala por si só.

Para Coringa, `statScore` é a média dos cinco maiores entre os sete atributos.

## Conversão para OVR contínuo

Com `C = CFG_AVALIACAO`:

```text
lift        = statScore / 100 * C.OVR_SPAN
expected    = clamp(C.COH_LIFT0
                    + C.COH_SLOPE * (rating - C.RAT_BASE),
                    0,
                    C.OVR_SPAN)
over        = max(0, lift - expected - C.COH_TOLER)
base        = C.OVR_BASE + lift - (1 - C.COH_KEEP) * over
ratingBonus = max(0, rating - C.RAT_BASE)
              * C.RAT_K
              * ratingWeight
core        = base + ratingBonus
```

`ratingWeight` é limitado a 0,25–2. O OVR normal é `round(core)` limitado a
`OVR_MIN`–`OVR_MAX`.

## Exceção IGL

O IGL calcula o estilo usando sua combat role. Depois:

```text
iglOvr = clamp(round(core + IGL_TITULO[colocacao]), OVR_MIN, IGL_TETO)
```

Somente o IGL recebe o bônus curado por colocação. Colocação não altera o OVR
de fraggers.

## Invariantes

- OVR inteiro entre 5 e 22;
- o peso de rating afeta nível, nunca identidade do playstyle;
- normalização por soma dos pesos é obrigatória;
- clamps e arredondamento ocorrem nos pontos atuais;
- o snapshot de 85 IDs protege o resultado final.

