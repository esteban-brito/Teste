/* Configuração única e mutável da simulação. Os valores são copiados do bloco
   CFG_SIM legado e sua paridade é guardada pela API pública. */
export const CFG_SIM={
  D_MAPA:30,AMP_MAX:11,AMP_CONSIST:.7,PESO_EF:.55,LADO_CT:.8,FORMA_DIA:7,
  FORMA_TAIL_KNEE:2.2,FORMA_TAIL_SCALE:.2,LADO_COMP:1.05,
  MOM_STEP:.05,MOM_MAX:.14,TILT_STEP:.018,TILT_MAX:.1,
  D_DUELO:95,D_DUELO_PIST:360,OPEN_SCALE:520,CLUTCH_DUEL:.22,CLUTCH_X:.09,
  CLUTCH_EXP:1.55,LADO_MAPA_P:.013,SAVE_BASE:.105,SAVE_MEN:.035,SAVE_VALUE:.07,
  RND_SEGUNDOS:115,BOMBA_SEGUNDOS:40,TICK:5,
  CONTATO_BASE:.42,CONTATO_AGR:.1,CONTATO_RITMO:.6,CONTATO_MIN:.08,CONTATO_MAX:2.2,
  CONTATO_POS:1.45,CONTATO_DESV:.16,PLANT_BASE:.012,PLANT_TEMPO:.1,PLANT_MEN:.03,
  POST_EDGE:.07,DEFUSE_BASE:.065,DEFUSE_MEN:.1,PLANT_BONUS:800,
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

export const MAPA_LADO={Nuke:1.9,Train:1.3,Overpass:.7,Ancient:.8,
  Mirage:.2,Inferno:0,Dust2:0,Anubis:-.7};
export const MAPAS_POOL=["Mirage","Inferno","Nuke","Ancient","Anubis","Dust2","Train","Overpass"];
