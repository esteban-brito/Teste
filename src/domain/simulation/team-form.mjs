/* MARÉ — oscilação da força efetiva do time naquele mapa.
   ========================================================

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade
   é provada por tools/check-team-form-parity.js.

   A química controla consistência, não força adicional: um time coeso oscila
   menos ao redor da força efetiva já calculada pelo SINAPSE; um time caótico
   tem uma faixa maior. O sorteio é uniforme e consome exatamente UMA chamada
   ao gerador.

   O gerador e as configurações entram por parâmetro. Isso permite provar tanto
   o valor retornado quanto a posição final do RNG, sem congelar no módulo os
   objetos de configuração que ainda pertencem ao motor legado. */

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

/** Campos de CFG_SIM consumidos pela oscilação da força do time. */
export const CFG_PADRAO={AMP_MAX:11,AMP_CONSIST:.7};

/** Limites de química consumidos da configuração do SINAPSE. */
export const CFG_QUIMICA_PADRAO={QUIMICA_MIN:.50,QUIMICA_MAX:1.00};

/** Força do time naquele mapa. `random` consome exatamente uma amostra uniforme. */
export function forcaDoDia(
  efetiva,
  quimica,
  random,
  cfg=CFG_PADRAO,
  cfgQuimica=CFG_QUIMICA_PADRAO
){
  const consist=clamp(
    (quimica-cfgQuimica.QUIMICA_MIN)/
      (cfgQuimica.QUIMICA_MAX-cfgQuimica.QUIMICA_MIN),
    0,
    1
  );
  const amp=cfg.AMP_MAX*(1-consist*cfg.AMP_CONSIST);
  return efetiva+(random()*2-1)*amp;
}
