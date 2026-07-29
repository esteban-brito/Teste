/* PRISMA — classificação de função: da afinidade contínua para o par
   primária/secundária que o jogo mostra e a química consome.
   ══════════════════════════════════════════════════════════════════════════════

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-role-classification-parity.js sobre os 85 e sobre
   entradas degeneradas.

   Sem gates nem números mágicos soltos: primária é a maior afinidade, secundária
   é a melhor das restantes pelo `secondaryScore`, e o paradoxo é um DESCONTO na
   escolha, nunca um veto.

   DOIS DETALHES QUE SÃO CONTRATO, não estilo:

   1. O retorno é um ARRAY com uma propriedade `secForte` pendurada. Formato
      legado, preservado de propósito — a química lê `secForte` e o snapshot dos
      85 depende do array. Trocar por objeto é migração à parte.

   2. A ordem de `ROLES_COMBATE` decide desempates: quando duas funções empatam
      em afinidade, quem vem antes no array vence, porque `sort` é estável.
      Ver docs/architecture.md §Pontos de atenção, item 2. */

import {afinidades,ROLES_COMBATE,TABELAS_PADRAO} from "./role-affinity.mjs";
import {secondaryScore} from "./secondary-score.mjs";

/** Campos de CFG_AVALIACAO que a classificação consome. */
export const CFG_PADRAO={
  // pares que se contradizem: Entry quer ir na frente, Support e Lurker não.
  PARADOXO:[["Entry","Support"],["Entry","Lurker"]],
  // o terceiro colocado só desbanca um par paradoxal se chegar a 85% dele
  PARADOXO_PEN:.85
};

/** Acima disto o jogador é bi-funcional de verdade (grau contínuo → bool p/ química). */
export const SEC_FORTE_LIMIAR=.82;

const ehParadoxo=(a,b,pares)=>pares.some(([x,y])=>(a===x&&b===y)||(a===y&&b===x));

/** Par [primária, secundária] com `secForte` pendurado. IGL tem caminho próprio:
    a função dele é o comando, e a "secundária" é a função de combate real. */
export function classificar(p,tabelas=TABELAS_PADRAO,cfg=CFG_PADRAO){
  const sc=afinidades(p,tabelas);
  const ordem=ROLES_COMBATE.slice().sort((a,b)=>sc[b]-sc[a]);

  if(p.isIGL){const c=["IGL",ordem[0]];c.secForte=true;return c;}

  const prim=ordem[0];
  let sec=ordem.slice(1).sort((a,b)=>secondaryScore(prim,b,p,sc)-secondaryScore(prim,a,p,sc))[0];
  if(ehParadoxo(prim,sec,cfg.PARADOXO)&&ordem[2]&&sc[ordem[2]]>=sc[sec]*cfg.PARADOXO_PEN)sec=ordem[2];

  const c=[prim,sec];
  c.secForte=(secondaryScore(prim,sec,p,sc)/Math.max(1,sc[prim]))>=SEC_FORTE_LIMIAR;
  return c;
}

/** Garante uma secundária válida e diferente da primária. Usado quando o dado
    vem de fora (draft, editor do sandbox) e pode estar incompleto. */
export function roleSecundarioSeguro(primary,secondary,p,scores=null,tabelas=TABELAS_PADRAO){
  if(secondary&&secondary!==primary)return secondary;
  const sc=scores||afinidades(p,tabelas);
  return ROLES_COMBATE.filter(r=>r!==primary)
    .sort((a,b)=>secondaryScore(primary,b,p,sc)-secondaryScore(primary,a,p,sc))[0]||"Rifler";
}
