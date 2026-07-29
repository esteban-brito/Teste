/* PRISMA — passe de TIME: distribui as funções olhando o elenco, não o jogador
   isolado.
   ══════════════════════════════════════════════════════════════════════════════

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-role-distribution-parity.js sobre os 17 elencos.

   ESTE MÓDULO É DIFERENTE DOS OUTROS DO BLOCO: ele não é função pura. Muta os
   jogadores recebidos e devolve o mesmo array. É por isso que ele ganhou fatia
   própria — a prova tem de ser sobre elencos inteiros, não sobre entradas
   isoladas, e comparar a classificação individual contra o resultado daqui acusa
   divergência onde há só contexto de time.

   AS TRÊS REGRAS, e por que existem:

     cap por função — no máximo 2 primários iguais, e apenas 1 AWPer. Um time com
                      três Entries não existe no CS; o excedente desce para a
                      segunda melhor afinidade.
     AWP forçada    — quem PEGARIA AWPer mas foi barrado pelo teto recebe AWPer
                      como função 2, sempre. A habilidade não desaparece por não
                      caber no slot.
     AWP garantida  — se ninguém ficou de AWP, o de maior `sn` assume. Todo time
                      de CS tem um AWPer.

   IDEMPOTENTE: deriva da afinidade dos atributos, nunca do estado atual, então
   re-rodar é seguro. NÃO mexe em OVR nem em playstyle — ninguém é rebaixado por
   jogar fora da função ideal. */

import {afinidades,ROLES_COMBATE} from "./role-affinity.mjs";
import {roleSecundarioSeguro,SEC_FORTE_LIMIAR} from "./role-classification.mjs";
import {secondaryScore} from "./secondary-score.mjs";
import {aplicarAvaliacaoContextual} from "./player-evaluation.mjs";

/** Teto de primários por função. O AWPer é o único com teto 1. */
export const capRole=r=>r==="AWPer"?1:2;

/** Desempate da AWP órfã: `sn` manda; empate (ex.: todos 0) vai para quem tem
    melhor abertura, depois fogo. */
const notaAWP=j=>(j.sn??0)*1000+(j.op??0)+(j.fp??0)*.5;

/** Distribui funções no elenco. MUTA `engs` e devolve o mesmo array. */
export function distribuirRoles(engs){
  const naoIgl=engs.filter(e=>!e.isIGL);
  const sc=new Map(naoIgl.map(e=>[e,afinidades(e)]));   // mesma afinidade do PRISMA (fonte única)

  // todos os pares (jogador, função) ordenados por afinidade decrescente
  const cand=[];
  naoIgl.forEach(e=>ROLES_COMBATE.forEach(r=>cand.push({e,r,s:sc.get(e)[r]})));
  cand.sort((a,b)=>b.s-a.s);

  const count={};ROLES_COMBATE.forEach(r=>{count[r]=0;});
  const prim=new Map();
  cand.forEach(c=>{
    if(prim.has(c.e)||count[c.r]>=capRole(c.r))return;
    prim.set(c.e,c.r);count[c.r]++;
  });

  const melhorRole=e=>{
    const s=sc.get(e);
    return ROLES_COMBATE.reduce((b,r)=>s[r]>s[b]?r:b,ROLES_COMBATE[0]);
  };

  naoIgl.forEach(e=>{
    const p=prim.get(e),s=sc.get(e);
    const ord=ROLES_COMBATE.slice()
      .sort((a,b)=>secondaryScore(p,b,e,s)-secondaryScore(p,a,e,s));
    e.primario=p;
    e.secundario=roleSecundarioSeguro(p,ord.find(r=>r!==p),e,s);
    // barrado pelo teto de AWP → a AWP vira função 2, sempre
    if(p!=="AWPer"&&melhorRole(e)==="AWPer")e.secundario="AWPer";
    e.secForte=(secondaryScore(p,e.secundario,e,s)/Math.max(1,s[p]))>=SEC_FORTE_LIMIAR;
  });

  // ninguém de AWP (nem primário, nem IGL com AWP na 2ª)? o maior `sn` assume
  if(!engs.some(j=>j.primario==="AWPer"||(j.primario==="IGL"&&j.secundario==="AWPer"))){
    const c=engs.reduce((b,j)=>(notaAWP(j)>notaAWP(b)?j:b),engs[0]);
    if(c.primario==="IGL")c.secundario="AWPer";
    else{c.secundario=c.primario;c.primario="AWPer";}
  }

  engs.forEach(e=>aplicarAvaliacaoContextual(e));
  return engs;
}
