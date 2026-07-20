# Química e força — SINAPSE

Fonte executável atual: `quimicaPlaystyles`, `quimicaComposicao`,
`ovrTreinador`, `derivaCaracteristica` e `forcaTime` em `game.js`.

## Composição

A composição começa em multiplicador 1. Penalidades são multiplicativas.
Pilares observados:

- comando: melhor IGL por OVR;
- AWP;
- âncora: Lurker ou Support;
- iniciativa: Entry, com cobertura parcial de Rifler.

Um secundário forte conta 1; um nominal conta `SEC_NOMINAL_PESO`. Duas pessoas
com o mesmo secundário dão cobertura completa do pilar. IGL conta também com sua
combat role. Saturação usa dureza por role e alívio para Rifler versátil.

Comando é separado da química comum:

```text
penCmd = 1 - penalidadeDeComando
```

Ele é aplicado somente depois da resistência de talento; firepower não compra
um caller.

## Playstyles

Sinergias são aditivas antes da compressão. Entre elas: agressivo+support,
agressivo+trader, spacetaker+trader, infiltrator+cerebral e anchor+clutcher.

Conflitos:

- três ou mais Playmaker/Baiter: -15%;
- pace médio abaixo de -0,15: -10%;
- dois ou mais Infiltradores: -10%;
- três ou mais estrelas: -15%. Estrela é uma classificação calculada por
  `rating >= CFG_NIVEL.ESTRELA_MIN` (atualmente 1,30), nunca por nome.

Coach pode acrescentar bônus ou reduzir conflitos. Coringa divide pela metade
somente as penalidades de playstyle.

Após bônus e penalidades:

```text
raw = clamp(bonusBase - penalties, 0,50, 1,08)
playstyleMultiplier = clamp(1 + (raw - 1) * 0,55, 0,90, 1,05)
```

## Treinador

```text
coachOvr = clamp(round(
  placementBase + TREINADOR_STR * max(0, teamOvrSum - expectedSum)
), TREINADOR_MIN, TREINADOR_MAX)
```

A característica deriva de scores de Gestor, Desenvolvedor, Estrategista e
Motivador; o maior vence se alcançar o limiar, senão Motivador.

## Resistência de talento e força

```text
rawStrength = sum(player.ovr)
resistance  = clamp((rawStrength - refBruta) / divisor, 0, 1) * recMax
baseEffChem = min(teto,
                  chemistryWithoutCommand
                  + (1 - chemistryWithoutCommand) * resistance)
effectiveChemistry = clamp(baseEffChem * penCmd,
                           QUIMICA_MIN,
                           QUIMICA_MAX)
coachFactor = 1 + (coachOvr - neutro) * porPonto
effectiveStrength = floor(rawStrength * effectiveChemistry * coachFactor + 0,4)
```

O arredondamento `floor(x + 0.4)` é deliberado e faz parte do contrato.

## Invariantes

- composição perfeita não recebe bônus estrutural acima de 100% apenas por não
  ter penalidades;
- comando é aplicado depois da resistência;
- alertas mantêm ordem estável porque a UI atual os interpreta;
- duas coberturas secundárias equivalem a um primário para pilares;
- química e força permanecem idênticas em extrações estruturais.
