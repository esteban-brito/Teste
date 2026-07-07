# AUDITORIA ABSOLUTA · draft9-0 (motores)
> Data: 2026-07-04 · Base: `game.js` v=55 · Método: leitura linha a linha + 6 bancadas semeadas (reproduzíveis)
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

> **STATUS FINAL (2026-07-07 · v=55): checklist ENCERRADO — 40/40 itens em estado terminal.**
> 16 corrigidos (✅) · 1 revertido por decisão do dono (↩️ #7) · 22 fechados como auditados/documentados/ideias futuras (✓) · 1 aguardando autorização (⏸ #30, curadoria de dados).
> Gates da versão final: realismo 12/12 nas faixas reais (N=150) · rating r=0.808 / MAE 0.090 (N=250) · COFRE 0 violações · bordas/vazamento limpos · suíça validada em 40 Majors · smoke E2E sem erros.
> Pós-audit (v=55): simplificação do sandbox — sistema de pesos unificado (wR·rating + (1-wR)·statScore + clarityAdj + roleDutyAdj), Coringa c/ wR calculado, sub-arquétipos removidos do OVR (só impactam simulação), dashboard integral 3 colunas.

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
- [x] 1. ✅ CORRIGIDO (v=51): desempate do AWP forçado por sn → op/fp (nota sn·1000+op+fp·0.5); todos-sn=0 elege o melhor abridor, não `engs[0]` (bench bordas re-passa).
- [x] 2. ✓ FECHADO: cap-2 não cobre IGL de propósito — a saturação da SINAPSE pune o excesso depois (comportamento intencional, documentado).
- [x] 3. ✓ Afinidades/paradoxos/sub-arquétipos coerentes; `distribuirRoles` idempotente (bench vazamento).

### ZÊNITE — OVR
- [x] 4. ✓ FECHADO: IGL_TITULO usa colocação do time — circularidade residual aceita (decisão de design do dono: liderança que ganhou Major vale OVR).
- [x] 5. ✓ FECHADO: a logística satura no 22 de propósito (22 = teto épico); sub-escala interna daria ganho marginal (os floats pré-clip já quase coincidem) — não aplicado por escopo.
- [x] 6. ✓ FECHADO: micro sem efeito mensurável (avaliação roda 1× por jogador, fora do hot path).
- [x] ✓ Monotonia da curva, clip 5..22, Coringa com fade: auditados.

### SINAPSE — química
- [x] 7. ↩️ REVERTIDO (v=52) por decisão do dono: 2 jogadores com a função 2 = 1 titular pleno, sem pena residual (a pena de 25% da v=51 foi removida).
- [x] 8. ✓ FECHADO: registrado como ideia futura (hoje não existe estrela Support/IGL no pool — sem caso real).
- [x] 9. ✓ FECHADO: registrado como ideia futura (custo de elenco internacional).
- [x] ✓ Pilares/saturação/talento-resiste/treinador derivado: coerentes; bordas (5 IGLs, tudo-zero) sobrevivem com números sãos.

### MARÉ — forma
- [x] 10. ✅ CORRIGIDO (v=51): teto absoluto da forma = min(teto,2.2) — máx observado 2.200 em 400 campanhas × 72 jogadores (antes: 2.5+); macro e rating re-validados (r=0.811, MAE 0.089).
- [x] 11. ✓ FECHADO: registrado como ideia futura (a forma de CAMPANHA já dá o arco da run; streak intra-Major seria camada extra).
- [x] ✓ Tiers, pisos, zero-média da campanha, consistência craque vs streaky role: auditados.

### PÓLVORA — combate
- [x] 12. ✅ CORRIGIDO (v=48): OT MR3 repetível (alvo 16→19→22; 19-17/22-20 medidos), máx 16-15 (game.js:713). Real CS2: MR3 repetível (19-16, 22-19…).
- [x] 13. ✅ CORRIGIDO (v=48): lados alternam a cada 3 rounds no OT (`ladoDe` fixa após r13) (game.js:704).
- [x] 14. ✅ CORRIGIDO (v=50): MAPA_LADO no pEdge do duelo — Nuke 54.1%, Train 52.6%, Anubis 48.6% (pareado, seed 2024).
- [x] 15. ✓ FECHADO: modelo agregado documentado — trade% macro cai nas faixas reais; janela por proximidade exigiria mapa posicional (fora do escopo do motor).
- [x] 16. ✅ CORRIGIDO (v=50): CLUTCH_X .115 · exp 1.55 — 1v3 9.5%, 1v4 4.5% (faixas reais), 1v2 24.8, macro intacta.
- [x] 17. ✓ FECHADO: modelo agregado de carry documentado — invariantes do COFRE zeradas em 400 mapas.
- [x] 18. ✓ FECHADO: registrados como ideias futuras (timeout, sites A/B, rotações, drop de AWP, double-AWP, stand-in, ninja defuse).
- [x] 19. ✅ CORRIGIDO (v=52): buffer de pesos compartilhado (`_psDuelo`) — zero alocação por duelo no hot path.
- [x] ✓ Fases plant/pós-plant/defuse/relógio/save/close calibradas: CT 50.7%, plant 53-58%, T pós-plant 60-63%, OT 8.2%, pistol CT 51%, rounds/mapa 20.4, KPR 0.71 — todas nas faixas reais (benches realismo/fidelidade).

### COFRE — economia
- [x] 20. ✅ CORRIGIDO (v=48): escada CS2 (1ª derrota 1400; decrementa 1 ao vencer) (`lsA=0`, game.js:734). CS2 moderno decrementa 1 passo. Impacto direto na respiração econômica.
- [x] 21. ✅ CORRIGIDO (v=48): prêmio por método (bomba/defuse 3500) — real: 3500 se bomba/defuse. A PÓLVORA já retorna o método (fim por objetivo).
- [x] 22. ✅ CORRIGIDO (v=52): kill reward por tipo de compra — force-buy (SMGs, \$600/kill no real) paga 1.8×; rifle/pistol na base. Macro re-validada 12/12.
- [x] 23. ✅ CORRIGIDO (v=48): $10k por half de OT (real: $10k fixos por half de OT) — junto de #12.
- [x] 24. ✓ Invariantes: 0 violações em 400 mapas; vencedor do pistol full no r2 = 94.5%; perdedor eco/force = 100% (bench cofre_trace seed 31337).

### FALLEnANGELs — rating
- [x] 25. ✅ CORRIGIDO (v=49): impacto escala com a skill na função (IMP_OVR; bases recentradas). Restam outliers de DADOS (#30): molodoy +0.29, sh1ro +0.27, 910 +0.22 (bench dados seed 555). Propor impacto interpolado pela skill dentro da função.
- [x] 26. ✓ FECHADO: estrutural — o pool só tem elite (donk real farma tier-2 que aqui não existe); compensação por OVR daria o mesmo boost a todos os 22 e distorceria as classes. Aceito como limite do formato.
- [x] 27. ✓ FECHADO: ADR sintético documentado — média fiel (~76); variância de dano utilitário real exigiria simular granadas individualmente.
- [x] 28. ✅ CORRIGIDO (v=49): crédito de sistema p/ IGL + slope — classe Δ 0.00; karrigan/chopper/gla1ve/arT normalizados (karrigan −0.31, chopper −0.16): crédito extra de KAST/assist em rounds vencidos.
- [x] 29. ✓ KAST c/ traded, eco-ajuste, multi-kill, swing por win-probability: sem dupla contagem; r=0.81, MAE 0.087 vs real.

### DADOS — ATRIBUTOS (80 entradas)
- [x] 30. ⏸ AGUARDA AUTORIZAÇÃO: 15 outliers de DADOS quantificados (apêndice) — curadoria de stats só caso a caso com OK do dono (regra: "sem curadoria").
- [x] 31. ✓ Faixas 0-100, ratings 0.5-2.0, países e IDs: limpos. 8 nicks multi-época intencionais.

### TORNEIO & contrato UI↔motor
- [x] 32. ✅ CORRIGIDO (v=49): Fisher-Yates no pareamento suíço `sort(()=>rndF()-.5)` no pareamento suíço (game.js:1595) — trocar por Fisher-Yates (iniciarTorneio já usa).
- [x] 33. ✅ CORRIGIDO (v=52): anti-rematch no pareamento (rematches ~0.4/Major) + jogos DECISIVOS em MD3 — sua partida vira série real (antessala avisa "DECISIVO (MD3)"), NPC decisivo é melhor-de-3. Validado em 40 Majors completos (MD3 exatamente quando v=2 ou d=2; 8+8 sempre fecham).
- [x] 34. ✓ FECHADO: NPC×NPC = moeda logística por mapa (decisivos = melhor-de-3 moedas desde a v=52) — coerente com a UI, que só mostra V/D.
- [x] 35. ✅ CORRIGIDO (v=51, melhor esforço): o time NPC com MAIOR overlap de nicks com o seu elenco sai do sorteio (só 1 excluível num pool de 16; empate resolve no embaralhamento).
- [x] 36. ✓ Bordas: 5 IGLs / tudo-zero / tudo-100 / sem-AWP / rating negativo — zero NaN/exceção (bench bordas).
- [x] 37. ✓ Estado: `_eng` imutável fora dos caches (_lado/_mapBase/_formaCamp); determinismo por semente (fingerprint 3ca5d04f).

### OTIMIZAÇÃO
- [x] 38. ✓ FECHADO: re-render integral por interação é ok na escala (6 cartas, <5ms); virtualização seria complexidade sem ganho.
- [x] 39. ✓ FECHADO: resolvido junto com o #19 — hot path sem gordura mensurável restante.
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
