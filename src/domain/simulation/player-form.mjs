/* MARÉ — a forma do dia: o "humor competitivo" do jogador naquele mapa.
   ══════════════════════════════════════════════════════════════════════════════

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-player-form-parity.js.

   PRIMEIRO MÓDULO DESTE BLOCO QUE CONSOME AZAR, e por isso o contrato muda:

     O gerador entra por PARÂMETRO. Não é preferência de estilo — é a única forma
     de o checador provar que o módulo consome o RNG o MESMO número de vezes, na
     MESMA ordem, que o motor legado. Uma chamada a mais desloca todos os 45.900
     mapas seguintes, e nenhuma comparação de valor pegaria isso sozinha.

   A distribuição é ASSIMÉTRICA de propósito: a cauda de cima é larga (firepower
   explode), a queda é amortecida pelo tier, e o piso é resistente sem ser parede
   — acima do joelho é identidade, abaixo a continuação é suave e nunca chega a
   zero. Estrela oscila MENOS que role player: é o que separa o craque confiável
   do jogador de altos e baixos. */

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

/** Cortes de nível da carta (espelham CFG_NIVEL do bloco de avaliação). */
export const CFG_NIVEL_PADRAO={LENDA_OVR:21,STAR_OVR:18,SOLIDO_OVR:16};

/** Campos de CFG_SIM que a MARÉ consome. */
export const CFG_PADRAO={
  FORMA_TAIL_KNEE:2.2,FORMA_TAIL_SCALE:0.2,
  FORMA_PISO_BASE:0.5,FORMA_PISO_AMORT:0.35
};

/** Forma de CAMPANHA: sorteada uma vez e válida pelos 9 mapas da run. */
export const CFG_CAMP_PADRAO={AMP_TIME:0.22,
  AMP_JOG:{Lenda:0.12,Star:0.13,Solido:0.18,Role:0.23}};

/* piso = resistência a cair; vol = largura da oscilação. Estrela e lenda oscilam
   MENOS (piso alto, vol contida); role player é mais streaky. */
export const PERFIL_TIER={
  Lenda: {piso:.16,vol:.27,caudaBase:2.05,caudaFp:.65},
  Star:  {piso:.13,vol:.28,caudaBase:1.70,caudaFp:.50},
  Solido:{piso:.07,vol:.28,caudaBase:1.45,caudaFp:.40},
  Role:  {piso:.05,vol:.29,caudaBase:1.30,caudaFp:.20}};

/** Explosividade por função: largura e joelho da cauda de cima. */
export const PERFIL_ROLE={
  AWPer:{expl:1.32,cauda:1.32},Rifler:{expl:1.28,cauda:1.24},
  Entry:{expl:1.26,cauda:1.16},Lurker:{expl:1.14,cauda:1.16},
  Support:{expl:1.12,cauda:1.12},IGL:{expl:1.02,cauda:1.02}};

/* O OVR puxa o centro. Inclinação e base foram reajustadas ao remover
   FORMA_RATING: sozinho, o OVR precisa reproduzir a média (1,079) e o desvio
   (0,138) que o centro tinha quando misturava OVR e rating histórico. */
export const centroOVR=ovr=>clamp(0.277+(ovr-5)*0.064,0.53,1.44);

/** Mantém a forma positiva sem piso duro: abaixo do joelho a continuação
    exponencial é C1 e se aproxima de zero sem formar parede. */
export const formaPositiva=(valor,joelho=.05)=>
  valor>=joelho?valor:joelho*Math.exp(valor/joelho-1);

/** Continuação logarítmica C1: preserva tudo até o joelho e comprime o excesso.
    Estritamente crescente, sem limite superior. */
export const formaCaudaLivre=(valor,joelho,escala)=>
  valor<=joelho?valor:joelho+escala*Math.log1p((valor-joelho)/escala);

/** Tier de volatilidade. IGL/Support de pouco fogo é streaky por FUNÇÃO, não por
    nível — regra da carta, preservada. */
export function tierDe(j,nivel=CFG_NIVEL_PADRAO){
  const a=j._eng||j,ovr=j.ovr??a.ovr??13;
  const fp=a.fp??60,prim=a.primario||j.primario||"Rifler";
  if((prim==="IGL"||prim==="Support")&&fp<55&&ovr<nivel.STAR_OVR)return "Role";
  if(ovr>=nivel.LENDA_OVR)return "Lenda";
  if(ovr>=nivel.STAR_OVR)return "Star";
  if(ovr>=nivel.SOLIDO_OVR)return "Solido";
  return "Role";
}

/** Forma do dia. `gauss` é o gerador normal — CONSOME AZAR uma vez. */
export function formaDoDia(j,gauss,cfg=CFG_PADRAO,nivel=CFG_NIVEL_PADRAO){
  const a=j._eng||j,t=tierDe(j,nivel),p=PERFIL_TIER[t];
  // só a carta: o nível vem do OVR, não do rating histórico
  const centro=centroOVR(a.ovr??13)+(a._formaCamp??0);
  const fp=a.fp??60,sn=a.sn??0,cl=a.cl??45;
  const pr=PERFIL_ROLE[a.primario]||{expl:1,cauda:1};
  // OVR amplifica a explosão, mas suave: craque é consistente, não mais volátil
  const ovrAmp=clamp(((a.ovr??13)-13)/55,0,.18);
  const combust=clamp((fp-45)/50,0.05,1.35);          // firepower explode
  const apoio=clamp((sn*0.3+cl*0.4)/100,0,0.4);       // awp/clutch empurram menos
  const pisoExtra=clamp((sn*0.5+cl*0.3)/100,0,0.35);  // awp/clutch sobem o piso
  const piso=cfg.FORMA_PISO_BASE+p.piso*((a.ovr??13)-5)/17+pisoExtra*0.3;
  const joelhoCauda=Math.min(
    (p.caudaBase+p.caudaFp*clamp((fp-50)/50,0,1.3))*(1.35+(pr.cauda-1)*1.4),
    cfg.FORMA_TAIL_KNEE);

  const g=gauss();
  let desvio;
  // cauda para cima: firepower × explosão do role × OVR (amortecida — 1.50 é pico, não média)
  if(g>=0)desvio=g*p.vol*(0.45+(combust+apoio)*1.0)*pr.expl*(1+ovrAmp);
  else desvio=g*p.vol*(1-p.piso*1.1);                 // queda amortecida por tier

  let r=centro+desvio;
  if(r<piso)r=piso-(piso-r)*cfg.FORMA_PISO_AMORT;     // piso resistente, não parede
  return formaCaudaLivre(formaPositiva(r),joelhoCauda,cfg.FORMA_TAIL_SCALE);
}

/** Forma de CAMPANHA: um componente coletivo (o time "clica" ou não no evento)
    mais um individual por tier. Zero-média — não desloca o rating global, só faz
    cada run ser diferente. MUTA os jogadores (`_formaCamp`).

    CONSUMO DE AZAR: uma chamada por TIME, mais uma por JOGADOR, nessa ordem. */
export function sortearFormaCampanha(times,gauss,cfgCamp=CFG_CAMP_PADRAO,nivel=CFG_NIVEL_PADRAO){
  times.forEach(t=>{
    const seedTime=gauss()*cfgCamp.AMP_TIME;
    const lista=t.jogadores||(t.time&&t.time.jogadores)||[];
    lista.filter(Boolean).forEach(p=>{
      const a=p._eng||p;
      a._formaCamp=seedTime+gauss()*cfgCamp.AMP_JOG[tierDe(a,nivel)];
    });
  });
}
