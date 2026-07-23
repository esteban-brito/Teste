/* Fronteira mecânica do perfil de combate corrente. Os multiplicadores e a
   escolha da role ativa reproduzem game.js; mudar IGL para a role classificada
   será uma decisão de balanceamento posterior. */
const DUEL_CONVERSION={Rifler:1.0,AWPer:1.0,Entry:.98,Lurker:.97,Support:.92,IGL:.90};
const FRAG_MULTIPLIER={AWPer:.74,Lurker:.82,Rifler:.86,Entry:1.05,Support:1.02,IGL:1};
const RATING_IMPACT={AWPer:1.035,Entry:1.065,Lurker:1.04,Rifler:1.03,Support:.97,IGL:.955};

export function combatProfile(player){
  const source=player?._eng||player||{};
  const primaryRole=player?.primario||source.primario||null;
  const secondaryRole=player?.secundario||source.secundario||null;
  const classifiedCombatRole=player?.combatRole||source.combatRole||
    (primaryRole==="IGL"?(secondaryRole||"Rifler"):primaryRole);
  const activeCombatRole=primaryRole||"Rifler";
  return {
    primaryRole,
    secondaryRole,
    classifiedCombatRole:classifiedCombatRole||null,
    activeCombatRole,
    duelConversion:DUEL_CONVERSION[activeCombatRole]??.95,
    fragMultiplier:FRAG_MULTIPLIER[activeCombatRole]||1,
    ratingImpact:RATING_IMPACT[primaryRole]??1
  };
}
