/* PÓLVORA — os dois eixos DESACOPLADOS do combate.
   ══════════════════════════════════════════════════════════════════════════════

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-duel-weights-parity.js.

   A separação destes dois pesos é a decisão de modelagem mais importante da
   simulação, e ela vem de um dado real: a correlação entre firepower e rating é
   0,835 — alta, mas longe de 1. Então são dois eixos, não um:

     skillDuelo (OVR)      → quem GANHA o round. Um IGL de OVR alto e fogo baixo
                             puxa a vitória do time mesmo fragando pouco.
     fragPeso (FIREPOWER)  → quem FRAGA dentro do time, e portanto o rating
                             individual. Um IGL de fp 2 fraga pouco e tem rating
                             baixo mesmo sendo decisivo para vencer.

   É o que o CS real mostra, e é o que impede o simulador de premiar quem vence
   como se ele tivesse fragado.

   Sem azar: os dois são determinísticos. O sorteio entra depois, no duelo. */

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

/** Campos de CFG_SIM consumidos aqui. */
export const CFG_PADRAO={
  DUELO_BASE:12,DUELO_OVR:4.6,
  FRAG_FP_BASE:35,FRAG_OVR:0.003,FRAG_OVR_MULT:0.045,FRAG_OVR_REF:17.56,
  FRAG_ROLE:{AWPer:0.74,Lurker:0.82,Rifler:0.86,Entry:1.05,Support:1.02,IGL:1}
};

/** Força de duelo: o que decide o ROUND. Escala com OVR e é convertida pela
    função efetiva (AWPer/Rifler convertem cheio; Support e IGL, menos). */
export function skillDuelo(j,perfil,cfg=CFG_PADRAO){
  const a=j._eng||j,ovr=j.ovr??a.ovr??13;
  return (cfg.DUELO_BASE+(ovr-5)*cfg.DUELO_OVR)*perfil.duelConversion;
}

/* Quem fraga DENTRO do time: firepower dá o perfil, OVR dá o nível, função dá o
   volume. O multiplicador de nível vinha do rating histórico (FRAG_RATING) —
   informação que a carta não carrega. Hoje vem do OVR, que é onde o rating
   legitimamente entrou (nmOVR).

   FRAG_OVR_MULT saiu de uma regressão do multiplicador antigo sobre o OVR
   (0,0565 por ponto) e foi baixado para 0,045: é o valor em que a sobreposição
   entre bandas de OVR volta à faixa real de 25–40%, ou seja, um OVR 15 precisa
   conseguir superar um OVR 20 de vez em quando. */
export function fragPeso(j,perfil,cfg=CFG_PADRAO){
  const a=j._eng||j,fp=a.fp??60,ovr=j.ovr??a.ovr??13;
  const nivelMult=clamp(1+(ovr-cfg.FRAG_OVR_REF)*cfg.FRAG_OVR_MULT,.60,1.55);
  return (cfg.FRAG_FP_BASE+fp)*(1+(ovr-13)*cfg.FRAG_OVR)*nivelMult*perfil.fragMultiplier;
}
