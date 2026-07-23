/** Utility available for a contextual assist opportunity. */
export function assistContextProfile(player){
  const source=player?._eng||player||{};
  return {utility:(source.ut??50)/100};
}
