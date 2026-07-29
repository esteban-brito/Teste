/* Perfil de combate: IGL preserva a identidade de liderança, mas usa a função
   classificada pelo PRISMA nas decisões esportivas. */
export const DUEL_CONVERSION={Rifler:1.0,AWPer:1.0,Entry:.98,Lurker:.97,Support:.92,IGL:.90};
export const FRAG_MULTIPLIER={AWPer:.74,Lurker:.82,Rifler:.86,Entry:1.05,Support:1.02,IGL:1};
export const RATING_IMPACT={AWPer:1.035,Entry:1.065,Lurker:1.04,Rifler:1.03,Support:.97,IGL:.955};

export function combatProfile(player,tables={}){
  const source=player?._eng||player||{};
  const duelConversion=tables.DUEL_CONVERSION||DUEL_CONVERSION;
  const fragMultiplier=tables.FRAG_ROLE||tables.FRAG_MULTIPLIER||FRAG_MULTIPLIER;
  const ratingImpact=tables.RATING_IMPACT||RATING_IMPACT;
  const primaryRole=player?.primario||source.primario||null;
  const secondaryRole=player?.secundario||source.secundario||null;
  const classifiedCombatRole=player?.combatRole||source.combatRole||
    (primaryRole==="IGL"?(secondaryRole||"Rifler"):primaryRole);
  const activeCombatRole=primaryRole==="IGL"?(classifiedCombatRole||"Rifler"):(primaryRole||"Rifler");
  return {
    primaryRole,
    secondaryRole,
    classifiedCombatRole:classifiedCombatRole||null,
    activeCombatRole,
    duelConversion:duelConversion[activeCombatRole]??.95,
    fragMultiplier:fragMultiplier[activeCombatRole]||1,
    ratingImpact:ratingImpact[activeCombatRole]??1
  };
}
