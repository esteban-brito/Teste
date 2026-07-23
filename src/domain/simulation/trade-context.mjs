/** Contextual signals for trade opportunity; no trade or KAST is credited here. */
export function tradeContextProfile(player){
  const source=player?._eng||player||{};
  return {
    readiness:((source.tr??50)+(source.ut??50))/200,
    tradeability:((source.en??45)+(source.tr??50))/200
  };
}
