# AUDITORIA ABSOLUTA · draft9-0 (motores)
> Data: 2026-07-04 · Base: `game.js` v=47 · Método: leitura linha a linha + 6 bancadas semeadas (reproduzíveis)
> Severidade: 🔴 bug · 🟠 infiel ao CS real · 🟡 aprimorável · 🔵 otimização · 💡 ideia · ✓ auditado e saudável

## Sumário executivo
| Motor | Nota | Veredito |
|---|---|---|
| PRISMA (classificação) | 9.0 | Sólido; 1 borda arbitrária no AWP forçado |
| ZÊNITE (OVR) | 8.5 | Curva sã; saturação no teto e circularidade residual do IGL (por design) |
| SINAPSE (química) | 8.5 | Coerente; dupla cobertura generosa demais |
| MARÉ (forma) | 8.5 | Variância realista; teto teórico alto (heater 2.91 já visto) |
| PÓLVORA (combate) | 8.0 | Núcleo excelente; OT infiel, sem viés de lado por mapa |
| COFRE (economia) | 8.0 | Invariantes limpos; loss bonus e prêmios divergem do CS2 moderno |
| FALLEnANGELs (rating) | 8.0 | r=0.81 vs real; impacto plano por role inflaciona AWPers fracos |
| Dados (ATRIBUTOS) | 8.5 | Faixas limpas; 15 outliers rating×stats quantificados |
| **Nenhum 🔴 (bug/crash/NaN) encontrado.** Bordas degeneradas sobrevivem; estado imutável; determinismo por semente provado. |

### Top-10 achados (prioridade de correção)
1. 🟠 **#20 Loss bonus reseta a zero ao vencer** — CS2 moderno decrementa 1 passo. Muda a respiração econômica.
2. 🟠 **#25 FA_IMPACTO plano por função** — AWPer fraco herda o multiplicador da elite (molodoy +0.29).
3. 🟠 **#12+#13+#23 Overtime infiel** — primeiro-a-16 único, lados não alternam, sem economia de OT (real: MR3 repetível, $10k).
4. 🟠 **#14 Sem viés de lado por mapa** — Nuke/Train CT-sided não existem; MAPA_PERFIL só modula atributos.
5. 🟠 **#21 Prêmio de vitória único (3250)** — real: 3500 por bomba/defuse; a PÓLVORA já sabe o método de vitória.
6. 🟡 **#7 Dupla cobertura zera penalidade** — 2 secundários nominais valem um titular pleno.
7. 🟡 **#32 Shuffle enviesado na suíça** — `sort(()=>rnd-.5)`; o resto do código já usa Fisher-Yates.
8. 🟡 **#16 Clutch 1v3/1v4 no piso** — 8.1%/3.0% vs 10-12%/4-5% reais.
9. 🟡 **#28 IGLs de sistema sub-representados no rating** (karrigan −0.31, chopper −0.16).
10. 💡 **#35 Jogador duplicado entre seu time e NPC** — donk pode jogar contra si mesmo no Major.

## O CHECKLIST (por motor)

### PRISMA — classificação
- [ ] 1. 🟡 AWP forçado com todos sn=0 elege `engs[0]` arbitrário (game.js:198-200). Propor desempate por op/fp.
- [ ] 2. 🟡 Cap-2 de função não cobre IGL (2 IGLs convivem; a saturação pune depois — comportamento ok, documentar).
- [x] 3. ✓ Afinidades/paradoxos/sub-arquétipos coerentes; `distribuirRoles` idempotente (bench vazamento).

### ZÊNITE — OVR
- [ ] 4. 🟡 IGL_TITULO usa colocação do time (circularidade residual, decisão de design do usuário) (game.js:~89).
- [ ] 5. 🟡 Curva satura no 22: múltiplos 22 são indistinguíveis no OVR inteiro (donk 1.75 = NiKo 1.70). Propor sub-escala interna p/ skillDuelo.
- [ ] 6. 🔵 `vers()` avaliado 2× por chamada no ramo IGL — micro.
- [x] ✓ Monotonia da curva, clip 5..22, Coringa com fade: auditados.

### SINAPSE — química
- [ ] 7. 🟡 `pilar`: secsRaw≥2 anula 100% da penalidade (game.js:235). Propor manter ~25% (2 nominais < 1 titular).
- [ ] 8. 💡 Atrito de ego só p/ FUNC_EGO; estrela Support/IGL nunca atrita (hoje não há caso; documentar).
- [ ] 9. 💡 Sem custo de elenco internacional (idioma/nacionalidade) — ideia futura.
- [x] ✓ Pilares/saturação/talento-resiste/treinador derivado: coerentes; bordas (5 IGLs, tudo-zero) sobrevivem com números sãos.

### MARÉ — forma
- [ ] 10. 🟠 Teto de forma permite heaters 2.9+ raros (real: pico de mapa ~2.5). Propor clamp da forma (~2.2) e re-checar variância.
- [ ] 11. 💡 Mapas são iid dentro da campanha (sem hot/cold streak intra-Major) — momentum de campanha como ideia.
- [x] ✓ Tiers, pisos, zero-média da campanha, consistência craque vs streaky role: auditados.

### PÓLVORA — combate
- [x] 12. ✅ CORRIGIDO (v=48): OT MR3 repetível (alvo 16→19→22; 19-17/22-20 medidos), máx 16-15 (game.js:713). Real CS2: MR3 repetível (19-16, 22-19…).
- [x] 13. ✅ CORRIGIDO (v=48): lados alternam a cada 3 rounds no OT (`ladoDe` fixa após r13) (game.js:704).
- [ ] 14. 🟠 Sem viés CT/T por mapa (Nuke ~56% CT real). Propor `ct` extra em MAPA_PERFIL somado ao LADO_CT.
- [ ] 15. 🟡 Trade: 1 tentativa pós-kill com chance fixa .62 — sem janela por proximidade/execute (modelo agregado; documentar).
- [ ] 16. 🟡 Clutch 1v3 8.1% / 1v4 3.0% (piso das faixas 10-12/4-5). Ajustar expoente CLUTCH_X (1.35→~1.5) com re-check macro.
- [ ] 17. 🟡 Save pós-plant do CT não diferencia equip salvo por lado (modelo agregado de carry — documentar).
- [ ] 18. 💡 Ausentes: timeout tático, sites A/B, rotações, drop de AWP ao morrer, double-AWP, stand-in, ninja defuse.
- [ ] 19. 🔵 `pick()` aloca array de pesos por duelo (~8/round). Buffer reutilizável ≈ −5-8% no hot path.
- [x] ✓ Fases plant/pós-plant/defuse/relógio/save/close calibradas: CT 50.7%, plant 53-58%, T pós-plant 60-63%, OT 8.2%, pistol CT 51%, rounds/mapa 20.4, KPR 0.71 — todas nas faixas reais (benches realismo/fidelidade).

### COFRE — economia
- [x] 20. ✅ CORRIGIDO (v=48): escada CS2 (1ª derrota 1400; decrementa 1 ao vencer) (`lsA=0`, game.js:734). CS2 moderno decrementa 1 passo. Impacto direto na respiração econômica.
- [x] 21. ✅ CORRIGIDO (v=48): prêmio por método (bomba/defuse 3500) — real: 3500 se bomba/defuse. A PÓLVORA já retorna o método (fim por objetivo).
- [ ] 22. 🟡 Kill reward plano (90 escala-time) — real varia por arma (rifle 300/SMG 600/AWP 100). Variar por buy como proxy.
- [x] 23. ✅ CORRIGIDO (v=48): $10k por half de OT (real: $10k fixos por half de OT) — junto de #12.
- [x] 24. ✓ Invariantes: 0 violações em 400 mapas; vencedor do pistol full no r2 = 94.5%; perdedor eco/force = 100% (bench cofre_trace seed 31337).

### FALLEnANGELs — rating
- [ ] 25. 🟠 Impacto plano por função infla AWPers modestos: molodoy +0.29, sh1ro +0.27, 910 +0.22 (bench dados seed 555). Propor impacto interpolado pela skill dentro da função.
- [ ] 26. 🟡 Elite comprimida (donk −0.23, NiKo −0.23, rain −0.19) — em parte estrutural (pool só-elite); avaliar compensação suave por OVR sem quebrar hierarquia.
- [ ] 27. 🟡 ADR sintético por constantes (média fiel ~76; sem variância de dano utilitário real — documentar).
- [ ] 28. 🟡 IGLs de sistema sub-representados (karrigan −0.31, chopper −0.16): crédito extra de KAST/assist em rounds vencidos.
- [x] 29. ✓ KAST c/ traded, eco-ajuste, multi-kill, swing por win-probability: sem dupla contagem; r=0.81, MAE 0.087 vs real.

### DADOS — ATRIBUTOS (80 entradas)
- [ ] 30. 🟡 15 outliers |sim−real| ≥ 0.15 quantificados (lista no apêndice) — revisar stats caso a caso (decisão do usuário; "sem curadoria" exceto autorizada).
- [x] 31. ✓ Faixas 0-100, ratings 0.5-2.0, países e IDs: limpos. 8 nicks multi-época intencionais.

### TORNEIO & contrato UI↔motor
- [ ] 32. 🟡 Shuffle enviesado `sort(()=>rndF()-.5)` no pareamento suíço (game.js:1595) — trocar por Fisher-Yates (iniciarTorneio já usa).
- [ ] 33. 🟡 Suíça sem anti-rematch/Buchholz; real: BO3 nos rounds decisivos. Propor MD3 em jogos de classificação/eliminação.
- [ ] 34. 🟡 NPC×NPC da suíça = moeda logística (sem placar/OT) — coerente com a UI (só V/D); documentado.
- [ ] 35. 💡 NPCs podem conter jogadores escalados no SEU time (donk vs donk). Propor filtrar times com jogadores seus do sorteio de 15.
- [x] 36. ✓ Bordas: 5 IGLs / tudo-zero / tudo-100 / sem-AWP / rating negativo — zero NaN/exceção (bench bordas).
- [x] 37. ✓ Estado: `_eng` imutável fora dos caches (_lado/_mapBase/_formaCamp); determinismo por semente (fingerprint 3ca5d04f).

### OTIMIZAÇÃO
- [ ] 38. 🔵 UI re-renderiza picks/lineup inteiros por interação (innerHTML) — ok na escala atual.
- [ ] 39. 🔵 #19 (pick buffer) é a única gordura mensurável restante do hot path.
- [x] 40. ✓ Modo leve −20%/mapa; zero alocação por kill; bancada versionada roda em minutos.

## Quadro de fidelidade (sim × CS real)
| Métrica | Sim | Real | Fonte |
|---|---|---|---|
| Rounds/mapa | 20.4 | 20–22 | fidelidade seed 4242, 36k mapas |
| Overtime | 8.2% | 8–14% | idem |
| Pistol win CT | 51.0% | 50–55% | idem |
| KPR | 0.71 | 0.66–0.72 | idem |
| CT-round win | 50.7% | 47–54% | bancada/realismo |
| Plant | 53–58% | 46–60% | idem |
| T win pós-plant | 60–63% | 56–72% | idem |
| Anti-eco (full×eco) | 76–77% | 70–90% | idem |
| Conversão pós-pistol | 69–70% | 60–84% | idem |
| Clutch 1v1/1v2/1v3 | 50/23.5/8.1% | 44-56/18-28/5-13% | idem |
| Favorito gap 0-3/16+ | 53/88% | 50-58/82-93% | idem |
| Rating: correlação r | 0.81 | ≥0.75 | bancada/rating |
| Rating: erro médio | 0.087 | ≤0.12 | idem |
| Full-buy pós-pistol (vencedor) | 94.5% | 85–100% | cofre_trace seed 31337 |

## Apêndice — reprodução
- Suíte oficial: `node bancada/run.js` (N=300/400) — sai ≠0 se degradar.
- Bancadas da auditoria (em /tmp/aud, semeadas): fidelidade(4242) · cofre_trace(31337) · bordas · vazamento(1) · dados(555).
- Outliers #30: karrigan −0.31 · molodoy +0.29 · sh1ro +0.27/+0.21 · NiKo −0.23 · donk −0.23/−0.18 · 910 +0.22 · rain −0.19 · byali −0.19 · olofmeister −0.18 · Perfecto −0.17 · magixx −0.17 · chopper −0.16 · Qikert −0.15.
