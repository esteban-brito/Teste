/* Configuração única e mutável da simulação. Os valores são copiados do bloco
   CFG_SIM legado e sua paridade é guardada pela API pública. */
export const CFG_SIM={
  D_MAPA:30,AMP_MAX:11,AMP_CONSIST:.7,PESO_EF:.55,LADO_CT:.8,FORMA_DIA:7,
  FORMA_TAIL_KNEE:2.2,FORMA_TAIL_SCALE:.2,LADO_COMP:1.05,
  MOM_STEP:.05,MOM_MAX:.14,TILT_STEP:.018,TILT_MAX:.1,
  D_DUELO:95,D_DUELO_PIST:360,OPEN_SCALE:520,CLUTCH_DUEL:.22,CLUTCH_X:.09,
  CLUTCH_EXP:1.55,LADO_MAPA_P:.013,SAVE_BASE:.105,SAVE_MEN:.035,SAVE_VALUE:.07,
  RND_SEGUNDOS:115,BOMBA_SEGUNDOS:40,TICK:5,
  CONTATO_BASE:.48,CONTATO_AGR:.1,CONTATO_RITMO:.6,CONTATO_MIN:.08,CONTATO_MAX:2.2,
  /* PLANT_BASE e DEFUSE_BASE sobem JUNTOS (04/08/2026). Recalibrar o viés de
     lado dos mapas para o CS real levou a taxa de CT de 50,6% para 52,0% — e
     derrubou o Plant% de 46,4 para 45,9, fora da faixa [46–60], porque bomba
     plantada favorece o TR e as duas métricas estão amarradas.

     Mexer só no plant trocaria uma métrica pela outra: subir plants derrubaria a
     taxa de CT, que é o único número aqui com dado real por trás. Subir os dois
     reproduz o que o CS faz de verdade — o T planta MAIS e o CT retoma MAIS —,
     e devolve as três ao lugar: CT 52,0%, Plant 50,8%, T pós-plant 62,7%.

     Plant e pós-plant foram para o MEIO da faixa, não para a borda: não há dado
     público da taxa real de plants, e o Plant% ficar a 0,4 ponto do piso foi
     exatamente o que fez esta fatia estourar. */
  CONTATO_POS:1.45,CONTATO_DESV:.16,PLANT_BASE:.027,PLANT_TEMPO:.1,PLANT_MEN:.03,
  POST_EDGE:.07,DEFUSE_BASE:.086,DEFUSE_MEN:.1,PLANT_BONUS:800,
  UTIL_COMPRA:{pistol:.2,eco:.05,force:.35,full:1,awp:1},
  UTIL_PLANT:.025,UTIL_RETAKE:.025,BUY_LE_FULL:1,
  EXP_KILL:1.15,EXP_OPEN:1.1,TRADE_CHANCE:.56,TRADE_CONTEXT:.15,
  FRAG_ROLE:{AWPer:.74,Lurker:.82,Rifler:.86,Entry:1.05,Support:1.02,IGL:1},
  ADR_SCALE:.7,KAST_TRADE_P:.45,W_OP_KILL:.28,W_TR_KILL:.32,
  ADR_KILL:95,ADR_VIT:55,ADR_AST:40,ADR_CHIP:14,
  ASSIST_CHANCE:.3,ASSIST_OPEN_MULT:1.15,ASSIST_CONTEXT:.1,ASSIST_BASE:12,
  ASSIST_UT_W:.9,ASSIST_DEAD_W:.5,
  FRAG_FP_BASE:35,FRAG_OVR:.003,FRAG_OVR_MULT:.045,FRAG_OVR_REF:17.56,
  DUELO_BASE:12,DUELO_OVR:4.6,
  CONTACT_VOLUME_EXP:{opening:.5,preplant:.55,postplant:.55},
  CONTACT_AGR:{opening:.45,preplant:.28,postplant:.28},
  CONTACT_OP:{opening:.06,preplant:.02,postplant:.02},
  CONTACT_EN:{opening:{CT:.3,TR:.35},preplant:{CT:.02,TR:.06},postplant:{CT:.08,TR:0}},
  CONTACT_POS:{
    AWPer:{opening:.1,preplant:.03,postplant:.03},
    Lurker:{opening:.06,preplant:.03,postplant:.03},
    Support:{opening:.02,preplant:.01,postplant:.01},
    Rifler:{opening:.02,preplant:.01,postplant:.01}
  },
  MAPA_SCALE:380,MAPA_CAP:.06,AGR_ABRE:2,MOM_HEAT:.3,
  STYLE_AGR:1.4,STYLE_LADO:{ct:5.9,t:5.2},FORMA_PISO_BASE:.5,FORMA_PISO_AMORT:.35
};

export const CFG_CAMP={AMP_TIME:.22,
  AMP_JOG:{Lenda:.12,Star:.13,Solido:.18,Role:.23}};

export const CFG_FA={BASE:.614,W_EK:.385,W_SURV:.16,W_KAST:.24,W_MULTI:.042,
  W_SWING:.1,PESO_MORTE:.95,PESO_OPEN:.216,W_ADR:.0019,ADR_REF:76,
  W_TRADE:.075,OPEN_D_W:.6,IMP_OVR:.012,IGL_SIS:.015};

/* VIÉS DE LADO POR MAPA. O valor NÃO é a taxa de vitória: ele entra em `pEdgeA`
   escalado por `LADO_MAPA_P`. A relação medida é linear na faixa útil —
   `CT% ≈ 49,85 + 1,918 × bias` —, e é dela que cada número abaixo foi derivado.

   FONTE: taxas de CT dos últimos 12 meses, fornecidas pelo responsável em
   04/08/2026. Alvos, em % de round vencido pelo CT:

     Mirage 54,9 · Nuke 54,6 · Cache 52,9 · Ancient 51,8
     Inferno 51,5 · Dust2 50,9 · Anubis 47,5

   Duas correções que esses dados trouxeram, e valem registro porque a intuição
   erra as duas: **Cache e Inferno são CT-sided**, não T-sided como as fontes
   secundárias afirmavam; e a amplitude real entre o mapa mais CT e o mais TR é
   de **7,4 pontos**, não os ~13 que os blogs sugeriam. A tabela anterior
   espalhava 6,0 pontos — estava perto, e o erro dela era só de DIREÇÃO em
   Mirage e Inferno, ambos deixados neutros. Recalibrar para 13 pontos, como eu
   cheguei a propor, teria exagerado o espalhamento em 60%.

   Recalibrar de novo é trocar os alvos acima e remedir com a relação linear. */
/* Os valores já saem descontados de um viés sistemático de +0,23 ponto medido na
   primeira passada — daí não serem exatamente `(alvo − 49,85)/1,918`. */
export const MAPA_LADO={Mirage:2.51,Nuke:2.46,Cache:1.47,Ancient:.95,
  Inferno:.74,Dust2:.64,Anubis:-1.04};
/* Pool ativo do CS real desde 22/06/2026, quando Cache voltou e Overpass saiu
   (HLTV). Train tinha saído antes, para a volta de Anubis. */
export const MAPAS_POOL=["Mirage","Inferno","Nuke","Ancient","Anubis","Dust2","Cache"];
